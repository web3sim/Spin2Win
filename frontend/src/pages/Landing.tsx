import { ConnectButton } from '@mysten/dapp-kit'

interface LandingProps {
  onEnter: () => void
}

export default function Landing({ onEnter }: LandingProps) {
  return (
    <section className="landing">
      <div className="landing-glow" />
      <h1>Spin2Win</h1>
      <p>
        Spin an on-chain reward wheel with transparent tier distribution and immutable outcomes.
      </p>
      <div className="landing-actions">
        <ConnectButton />
        <button className="cta" onClick={onEnter}>Enter Spin Arena</button>
      </div>
      <div className="landing-meta">Common tiers · Rare hits · Jackpot moments</div>
    </section>
  )
}
