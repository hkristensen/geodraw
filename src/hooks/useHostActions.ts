import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useWorldStore } from '../store/worldStore'
import { useMultiplayerStore } from '../store/multiplayerStore'
import { subscribeToActions, markActionProcessed } from '../firebase/actions'

export function useHostActions() {
    const { isMultiplayer, isHost, gameId: multiplayerGameId } = useMultiplayerStore()

    useEffect(() => {
        if (!isMultiplayer || !isHost || !multiplayerGameId) return

        console.log('🛡️ Host Action Listener Active')

        const unsubscribe = subscribeToActions(multiplayerGameId, (actions) => {
            if (actions.length === 0) return

            actions.forEach(async (action) => {
                try {
                    console.log('⚡ Processing Action:', action.type, action.payload)

                    switch (action.type) {
                        case 'DECLARE_WAR':
                            const { targetCountry } = action.payload
                            if (targetCountry) {
                                useWorldStore.getState().declareWar(targetCountry)
                                console.log('✅ Action Processed: War Declared on', targetCountry)
                            }
                            break

                        case 'LAUNCH_OFFENSIVE':
                            const { targetCountry: defCode, amount, intensity, plan } = action.payload
                            const defender = useWorldStore.getState().aiCountries.get(defCode)
                            const playerNation = useGameStore.getState().nation

                            if (defender && playerNation) {
                                // Default soldiers if not specified
                                const attackers = amount || 50000
                                const defenders = defender.soldiers ? Math.floor(defender.soldiers * 0.1) : 10000

                                useGameStore.getState().startBattle(
                                    playerNation.constitution ? 'PLAYER' : 'PLAYER',
                                    playerNation.name,
                                    defCode,
                                    defender.name,
                                    attackers,
                                    defenders,
                                    intensity || 'skirmish',
                                    true, // isPlayerAttacker
                                    false, // isPlayerDefender
                                    undefined,
                                    undefined,
                                    0, // defenseBonus
                                    plan
                                )
                                console.log('✅ Action Processed: Offensive Launched against', defender.name)
                            }
                            break

                        case 'LAUNCH_NUCLEAR_STRIKE':
                            const { location, countryCode } = action.payload
                            if (location && countryCode) {
                                useWorldStore.getState().launchNuclearStrike(
                                    location,
                                    countryCode
                                )
                                console.log('☢️ Action Processed: Nuclear Strike on', countryCode, 'at', location)
                            }
                            break
                    }

                    await markActionProcessed(multiplayerGameId, action.id, 'processed')

                } catch (e) {
                    console.error('❌ Action Failed:', e)
                    await markActionProcessed(multiplayerGameId, action.id, 'failed')
                }
            })
        })

        return () => unsubscribe()
    }, [isMultiplayer, isHost, multiplayerGameId])
}
