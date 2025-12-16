import * as turf from '@turf/turf'
import type { Feature, Polygon, MultiPolygon, FeatureCollection } from 'geojson'
import type { ExpansionClaim, ExpansionResolutionMethod } from '../types/game'
import type { AICountry } from '../types/game'
import type { Consequence } from '../types/store'

interface ResolutionResult {
    success: boolean
    message: string
    warDeclared?: boolean
    territoryClaimed?: Feature
    consequencesGained?: Consequence[]
}

/**
 * Calculate which countries an expansion claim affects
 */
export function analyzeExpansionClaim(
    claimPolygon: Feature<Polygon | MultiPolygon>,
    worldGeoJSON: FeatureCollection,
    existingConsequences: Consequence[]
): ExpansionClaim['targetCountries'] {
    const targets: ExpansionClaim['targetCountries'] = []

    for (const countryFeature of worldGeoJSON.features) {
        if (
            countryFeature.geometry.type !== 'Polygon' &&
            countryFeature.geometry.type !== 'MultiPolygon'
        ) {
            continue
        }

        const props = countryFeature.properties as {
            name?: string
            name_long?: string
            adm0_a3?: string
            iso_a3?: string
        }
        const countryCode = props.iso_a3 || props.adm0_a3 || 'UNK'
        const countryName = props.name_long || props.name || 'Unknown'

        try {
            const intersection = turf.intersect(
                turf.featureCollection([claimPolygon, countryFeature as Feature<Polygon | MultiPolygon>])
            )

            if (intersection) {
                const intersectionArea = turf.area(intersection) / 1_000_000 // km²
                const countryArea = turf.area(countryFeature) / 1_000_000 // km²

                // Account for already-captured territory
                const existingLoss = existingConsequences.find(c => c.countryCode === countryCode)
                const remainingCountryArea = existingLoss
                    ? countryArea * (1 - existingLoss.lostPercentage / 100)
                    : countryArea

                const percentageClaimed = (intersectionArea / remainingCountryArea) * 100

                if (percentageClaimed > 0.1) {
                    targets.push({
                        code: countryCode,
                        name: countryName,
                        areaClaimedKm2: intersectionArea,
                        percentageClaimed,
                    })
                }
            }
        } catch (e) {
            // Skip problematic geometries
        }
    }

    return targets.sort((a, b) => b.percentageClaimed - a.percentageClaimed)
}

/**
 * Attempt to resolve an expansion claim
 */
export function resolveExpansion(
    claim: ExpansionClaim,
    method: ExpansionResolutionMethod,
    playerPower: number,
    targetCountries: Map<string, AICountry>
): ResolutionResult {
    // Calculate total resistance power
    let totalResistance = 0
    let averageRelations = 0
    let hostileCount = 0

    for (const target of claim.targetCountries) {
        const country = targetCountries.get(target.code)
        if (country) {
            totalResistance += country.power * (target.percentageClaimed / 100)
            averageRelations += country.relations
            if (country.disposition === 'hostile' || country.disposition === 'at_war') {
                hostileCount++
            }
        }
    }

    if (claim.targetCountries.length > 0) {
        averageRelations /= claim.targetCountries.length
    }

    console.log(`🎯 Resolving expansion: method=${method}, playerPower=${playerPower}, resistance=${totalResistance.toFixed(1)}`)

    switch (method) {
        case 'NEGOTIATE': {
            // Requires good relations (> 30) and no hostile countries
            if (hostileCount > 0) {
                return {
                    success: false,
                    message: `Negotiations failed! ${hostileCount} hostile nation(s) refused to negotiate.`,
                }
            }
            if (averageRelations < 30) {
                return {
                    success: false,
                    message: `Negotiations failed! Relations too poor (${averageRelations.toFixed(0)} average, need 30+).`,
                }
            }
            return {
                success: true,
                message: 'Negotiations successful! Territory peacefully acquired.',
                territoryClaimed: claim.polygon as Feature,
            }
        }

        case 'DEMAND': {
            // Requires significant power advantage (1.5x)
            const requiredPower = totalResistance * 1.5
            if (playerPower < requiredPower) {
                return {
                    success: false,
                    message: `Demand rejected! Insufficient power (${playerPower} vs required ${requiredPower.toFixed(0)}).`,
                }
            }
            return {
                success: true,
                message: 'Your overwhelming power forced acceptance of your demands!',
                territoryClaimed: claim.polygon as Feature,
            }
        }

        case 'WAR': {
            // Power comparison with random factor (±20%)
            const randomFactor = 0.8 + Math.random() * 0.4 // 0.8 to 1.2
            const effectivePlayerPower = playerPower * randomFactor

            console.log(`⚔️ War: effectivePlayerPower=${effectivePlayerPower.toFixed(1)} vs resistance=${totalResistance.toFixed(1)}`)

            if (effectivePlayerPower > totalResistance) {
                return {
                    success: true,
                    message: `Victory! Your forces have conquered the claimed territory.`,
                    warDeclared: true,
                    territoryClaimed: claim.polygon as Feature,
                }
            } else {
                return {
                    success: false,
                    message: `Defeat! Your military campaign has failed. (${effectivePlayerPower.toFixed(0)} vs ${totalResistance.toFixed(0)})`,
                    warDeclared: true,
                }
            }
        }
    }
}
