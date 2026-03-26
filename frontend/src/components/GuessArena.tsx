import { useEffect, useMemo, useState } from 'react'
import { useSignTransaction, useSuiClient } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { PACKAGE_ID, objectUrl, txUrl } from '../config/network'
import './GuessArena.css'

interface Props {
  account: { address: string }
}

type SpinItem = {
  player?: string
  tier?: number | string
  reward_points?: number | string
  nonce?: number | string
}

type WheelFields = {
  creator?: string
  total_spins?: number | string
  spins?: SpinItem[]
}

type WheelSummary = {
  id: string
  creator?: string
  digest?: string
}

const n = (v: number | string | undefined) => Number(v ?? 0)
const isHexObjectId = (v: string) => /^0x[0-9a-fA-F]{64}$/.test(v.trim())
const looksLikeTxDigest = (v: string) => !v.startsWith('0x') && /^[1-9A-HJ-NP-Za-km-z]{43,64}$/.test(v.trim())

const tierLabel = (t: number) => {
  if (t === 2) return 'Jackpot'
  if (t === 1) return 'Rare'
  return 'Common'
}

export default function GuessArena({ account }: Props) {
  const client = useSuiClient()
  const { mutateAsync: signTransaction } = useSignTransaction()

  const [wheelIdInput, setWheelIdInput] = useState('')
  const [wheelId, setWheelId] = useState('')
  const [wheel, setWheel] = useState<WheelFields | null>(null)
  const [wheels, setWheels] = useState<WheelSummary[]>([])
  const [txDigest, setTxDigest] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [action, setAction] = useState<'create' | 'spin' | null>(null)

  const myLastSpin = useMemo(() => {
    const mine = (wheel?.spins ?? []).filter((s) => (s.player ?? '').toLowerCase() === account.address.toLowerCase())
    return mine[mine.length - 1]
  }, [wheel?.spins, account.address])

  const execute = async (tx: Transaction) => {
    const signed = await signTransaction({ transaction: tx })
    return client.executeTransactionBlock({
      transactionBlock: signed.bytes,
      signature: signed.signature,
      options: { showEffects: true, showObjectChanges: true, showEvents: true },
      requestType: 'WaitForEffectsCert',
    })
  }

  const readWheel = async (input?: string) => {
    const raw = (input ?? wheelId).trim()
    if (!raw) return
    setError('')

    let id = raw
    if (looksLikeTxDigest(raw)) {
      const tx = await client.getTransactionBlock({ digest: raw, options: { showObjectChanges: true } })
      const found = tx.objectChanges?.find(
        (c) =>
          (c.type === 'created' || c.type === 'mutated') &&
          typeof c.objectType === 'string' &&
          c.objectType.includes('::wheel::Wheel') &&
          'objectId' in c,
      )
      if (!found || !('objectId' in found)) {
        setError('No Spin2Win wheel object found in this transaction digest.')
        return
      }
      id = found.objectId as string
    }

    if (!isHexObjectId(id)) {
      setError('Use a wheel object ID (0x...) or transaction digest.')
      return
    }

    const res = await client.getObject({ id, options: { showContent: true, showType: true } })
    const type = res.data?.type ?? ''
    const content = res.data?.content as { dataType?: string; fields?: unknown } | undefined
    if (!content || content.dataType !== 'moveObject' || typeof type !== 'string' || !type.includes('::wheel::Wheel') || !content.fields) {
      setError('Object is not a Spin2Win Wheel.')
      return
    }

    const rawFields = content.fields as {
      creator?: string
      total_spins?: number | string
      spins?: Array<{ fields?: SpinItem } | SpinItem>
    }
    const spins = (rawFields.spins ?? []).map((s) => {
      if (s && typeof s === 'object' && 'fields' in s && (s as { fields?: SpinItem }).fields) {
        return (s as { fields: SpinItem }).fields
      }
      return s as SpinItem
    })

    setWheel({ creator: rawFields.creator, total_spins: rawFields.total_spins, spins })
    setWheelId(id)
    setWheelIdInput(id)
  }

  const fetchWheels = async () => {
    if (!PACKAGE_ID) return
    const ev = await client.queryEvents({
      query: { MoveEventType: `${PACKAGE_ID}::wheel::WheelCreated` },
      limit: 20,
      order: 'descending',
    })
    const list = ev.data
      .map((e) => {
        const p = e.parsedJson as { wheel_id?: string; creator?: string } | null
        if (!p?.wheel_id) return null
        return { id: p.wheel_id, creator: p.creator, digest: e.id?.txDigest }
      })
      .filter((x): x is WheelSummary => Boolean(x))

    setWheels(Array.from(new Map(list.map((x) => [x.id, x])).values()))
  }

  useEffect(() => {
    void fetchWheels()
    const timer = setInterval(() => {
      if (!pending) void fetchWheels()
      if (!pending && wheelId) void readWheel(wheelId)
    }, 12_000)
    return () => clearInterval(timer)
  }, [wheelId, pending])

  const createWheel = () => {
    if (!PACKAGE_ID) {
      setError('Missing VITE_PACKAGE_ID in frontend/.env')
      return
    }
    setError('')
    void (async () => {
      setPending(true)
      setAction('create')
      try {
        const tx = new Transaction()
        tx.setSender(account.address)
        tx.setGasBudget(20_000_000)
        tx.moveCall({ target: `${PACKAGE_ID}::wheel::create_wheel`, arguments: [] })
        const res = await execute(tx)
        setTxDigest(res.digest)

        const created = res.objectChanges?.find(
          (c) => c.type === 'created' && typeof c.objectType === 'string' && c.objectType.includes('::wheel::Wheel'),
        )
        if (created && 'objectId' in created) {
          await readWheel(created.objectId as string)
        }
        await fetchWheels()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Create wheel failed')
      } finally {
        setPending(false)
        setAction(null)
      }
    })()
  }

  const spin = () => {
    if (!PACKAGE_ID || !wheelId) return
    setError('')
    void (async () => {
      setPending(true)
      setAction('spin')
      try {
        const tx = new Transaction()
        tx.setSender(account.address)
        tx.setGasBudget(20_000_000)
        tx.moveCall({ target: `${PACKAGE_ID}::wheel::spin`, arguments: [tx.object(wheelId)] })
        const res = await execute(tx)
        setTxDigest(res.digest)
        await readWheel(wheelId)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Spin failed')
      } finally {
        setPending(false)
        setAction(null)
      }
    })()
  }

  return (
    <section className="arena">
      <div>
        <div className="card">
          <h3>Create Reward Wheel</h3>
          <div className="btns">
            <button className="btn btn-primary" disabled={pending} onClick={createWheel}>
              {action === 'create' ? 'Creating...' : 'Create Wheel'}
            </button>
          </div>
        </div>

        <div className="card">
          <h3>Load Wheel</h3>
          <div className="form">
            <input className="input mono" value={wheelIdInput} onChange={(e) => setWheelIdInput(e.target.value)} placeholder="Wheel object ID (0x...) or tx digest" />
            <div className="btns">
              <button className="btn btn-secondary" disabled={pending} onClick={() => void readWheel(wheelIdInput)}>Load</button>
              {wheelId && <a className="link" href={objectUrl(wheelId)} target="_blank" rel="noreferrer">View Object</a>}
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          {txDigest && <a className="link" href={txUrl(txDigest)} target="_blank" rel="noreferrer">Last tx: {txDigest}</a>}
        </div>

        <div className="card">
          <h3>Spin</h3>
          <div className="btns">
            <button className="btn btn-spin" disabled={pending || !wheelId} onClick={spin}>
              {action === 'spin' ? 'Spinning...' : 'Spin Wheel'}
            </button>
          </div>
          {action === 'spin' && (
            <div className="spin-progress" role="status" aria-live="polite">
              <div className="spinner-wrap">
                <span className="spinner spinner-lg" aria-hidden="true" />
              </div>
              <div className="spin-copy">
                <strong>Rolling result on-chain...</strong>
                <span className="spin-sub">Reward points per tier</span>
                <div className="spin-points" aria-label="Reward points mapping">
                  <span>Common: 10 pts</span>
                  <span>Rare: 35 pts</span>
                  <span>Jackpot: 100 pts</span>
                </div>
              </div>
            </div>
          )}
          {myLastSpin && <div className="win">You got: {tierLabel(n(myLastSpin.tier))} · {n(myLastSpin.reward_points)} pts</div>}
        </div>
      </div>

      <div>
        <div className="card live-rounds">
          <h3>Live Wheels</h3>
          <div className="btns"><button className="btn btn-mini" disabled={pending} onClick={() => void fetchWheels()}>Refresh</button></div>
          {wheels.length === 0 && <div className="log-item">No wheels found yet.</div>}
          {wheels.map((w) => (
            <div className="log-item" key={w.id}>
              <div>Creator: <span className="mono">{w.creator}</span></div>
              <div className="btns">
                <button className="btn btn-mini" onClick={() => void readWheel(w.id)}>Load</button>
                {w.digest && <a className="link mono" href={txUrl(w.digest)} target="_blank" rel="noreferrer">{w.digest}</a>}
              </div>
            </div>
          ))}
        </div>

        <div className="card log">
          <h3>Spin History</h3>
          {(wheel?.spins ?? []).slice().reverse().map((s, i) => (
            <div className="log-item" key={`${s.player}-${i}`}>
              <div><span className="mono">{s.player}</span></div>
              <div>Spin #{n(s.nonce)} | Tier: {tierLabel(n(s.tier))} | Reward: {n(s.reward_points)}</div>
            </div>
          ))}
          {(!wheel?.spins || wheel.spins.length === 0) && <div className="log-item">No spins yet.</div>}
        </div>
      </div>
    </section>
  )
}
