module spin2win::wheel {
    use one::event;
    use one::object::{Self, UID};
    use one::transfer;
    use one::tx_context::{sender, TxContext};
    use std::vector;

    public struct SpinRecord has copy, drop, store {
        player: address,
        tier: u8,
        reward_points: u64,
        nonce: u64,
    }

    public struct Wheel has key, store {
        id: UID,
        creator: address,
        total_spins: u64,
        spins: vector<SpinRecord>,
    }

    public struct WheelCreated has copy, drop, store {
        wheel_id: address,
        creator: address,
    }

    public struct Spun has copy, drop, store {
        wheel_id: address,
        player: address,
        tier: u8,
        reward_points: u64,
        nonce: u64,
    }

    public entry fun create_wheel(ctx: &mut TxContext) {
        let wheel = Wheel {
            id: object::new(ctx),
            creator: sender(ctx),
            total_spins: 0,
            spins: vector::empty<SpinRecord>(),
        };
        let wheel_id = object::uid_to_address(&wheel.id);
        event::emit(WheelCreated {
            wheel_id,
            creator: sender(ctx),
        });
        transfer::share_object(wheel);
    }

    public entry fun spin(wheel: &mut Wheel, ctx: &mut TxContext) {
        let who = sender(ctx);
        let nonce = wheel.total_spins + 1;
        let roll = (nonce * 29 + 7) % 100;
        let tier = if (roll < 65) {
            0
        } else if (roll < 90) {
            1
        } else {
            2
        };
        let reward_points = if (tier == 2) {
            100
        } else if (tier == 1) {
            35
        } else {
            10
        };

        vector::push_back(&mut wheel.spins, SpinRecord {
            player: who,
            tier,
            reward_points,
            nonce,
        });
        wheel.total_spins = nonce;

        event::emit(Spun {
            wheel_id: object::uid_to_address(&wheel.id),
            player: who,
            tier,
            reward_points,
            nonce,
        });
    }
}
