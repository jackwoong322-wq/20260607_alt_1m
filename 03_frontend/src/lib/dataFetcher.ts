import { supabase, isSupabaseConfigured } from './supabaseClient';

const SUB_BOX_LAYER = "sub_box";
const SUB_BOX_SCOPE = "active_internal";

let sampleDataCache: any = null;

async function getSampleData() {
    if (sampleDataCache) return sampleDataCache;
    const res = await fetch('/legacy/sample-dashboard-data.json');
    if (!res.ok) throw new Error('Failed to load sample dashboard data');
    sampleDataCache = await res.json();
    return sampleDataCache;
}

function subBoxLabel(index: number): string {
    let label = "";
    let n = index;
    while (true) {
        label = String.fromCharCode(65 + (n % 26)) + label;
        n = Math.floor(n / 26) - 1;
        if (n < 0) return label;
    }
}

function sliceParentBoxData(data: any[], parentBox: any) {
    const startX = Number(parentBox.start_x || parentBox.startX || 0);
    const endX = Number(parentBox.end_x || parentBox.endX || 1000000000);
    return data.filter(p => p.x >= startX && p.x <= endX).sort((a, b) => a.x - b.x);
}

function makeSubBox(points: any[], parentBox: any, subIndex: number, isCompleted: boolean, breakoutBufferPct: number) {
    const upperPoint = points.reduce((max, p) => p.high > max.high ? p : max, points[0]);
    const lowerPoint = points.reduce((min, p) => p.low < min.low ? p : min, points[0]);
    const upper = Number(upperPoint.high);
    const lower = Number(lowerPoint.low);
    const startX = Number(points[0].x);
    const endX = Number(points[points.length - 1].x);
    const MathMax = Math.max;
    const MathAbs = Math.abs;
    const rangePct = lower > 0 ? (MathAbs(upper - lower) / lower) * 100.0 : 0.0;
    
    return {
        layer: SUB_BOX_LAYER,
        scope: SUB_BOX_SCOPE,
        parentBoxIndex: Number(parentBox.box_index || parentBox.boxIndex),
        parentPhase: parentBox.phase,
        parentResult: parentBox.result,
        subBoxIndex: subIndex,
        subBoxLabel: subBoxLabel(subIndex),
        startX,
        endX,
        upper,
        lower,
        pivotHighDay: Number(upperPoint.x),
        pivotLowDay: Number(lowerPoint.x),
        breakoutUpLevel: upper * (1.0 + breakoutBufferPct / 100.0),
        breakdownLevel: lower * (1.0 - breakoutBufferPct / 100.0),
        duration: endX - startX + 1,
        rangePct: rangePct.toFixed(1),
        is_completed: isCompleted ? 1 : 0,
        is_prediction: 0,
        source: "observed",
        visibility: "default",
        scenarioRole: "range_continuation"
    };
}

function detectSubBoxes(data: any[], parentBox: any, minDuration: number = 5, breakoutBufferPct: number = 0.5, minRangePct: number = 0.0) {
    if (parentBox.result !== "ACTIVE" && parentBox.result !== "BEAR_ACTIVE" && parentBox.result !== "BULL_ACTIVE") return [];
    
    const points = sliceParentBoxData(data, parentBox);
    if (points.length < minDuration) return [];
    
    const boxes = [];
    let start = 0;
    let subIndex = 0;
    
    while (start + minDuration <= points.length) {
        const seed = points.slice(start, start + minDuration);
        const seedUpper = Math.max(...seed.map(p => p.high));
        const seedLower = Math.min(...seed.map(p => p.low));
        const upperBreak = seedUpper * (1.0 + breakoutBufferPct / 100.0);
        const lowerBreak = seedLower * (1.0 - breakoutBufferPct / 100.0);
        
        let breakIdx = -1;
        for (let i = start + minDuration; i < points.length; i++) {
            const close = points[i].close;
            if (close > upperBreak || close < lowerBreak) {
                breakIdx = i;
                break;
            }
        }
        
        if (breakIdx === -1) {
            const box = makeSubBox(points.slice(start), parentBox, subIndex, false, breakoutBufferPct);
            if (Number(box.rangePct) >= minRangePct) boxes.push(box);
            break;
        }
        
        const end = breakIdx - 1;
        if (end - start + 1 >= minDuration) {
            const box = makeSubBox(points.slice(start, end + 1), parentBox, subIndex, true, breakoutBufferPct);
            if (Number(box.rangePct) >= minRangePct) {
                boxes.push(box);
                subIndex++;
            }
        }
        start = breakIdx;
    }
    
    if (boxes.length > 0 && boxes[boxes.length - 1].is_completed === 1 && start < points.length) {
        const tail = points.slice(start);
        if (tail.length >= minDuration) {
            const box = makeSubBox(tail, parentBox, subIndex, false, breakoutBufferPct);
            if (Number(box.rangePct) >= minRangePct) boxes.push(box);
        }
    }
    return boxes;
}

function candidateRole(subBox: any, currentClose: number, previousSubBox: any, proximityRatio: number, compressionRatio: number) {
    const upper = Number(subBox.upper);
    const lower = Number(subBox.lower);
    const breakoutUp = Number(subBox.breakoutUpLevel || upper);
    const breakdown = Number(subBox.breakdownLevel || lower);
    const width = Math.max(upper - lower, 0.0);
    
    if (currentClose >= breakoutUp) return "breakout_watch";
    if (currentClose <= breakdown) return "breakdown_watch";
    if (width > 0 && currentClose >= upper - width * proximityRatio) return "upper_test";
    if (width > 0 && currentClose <= lower + width * proximityRatio) return "lower_test";
    
    if (previousSubBox) {
        const prevRange = Number(previousSubBox.rangePct);
        const curRange = Number(subBox.rangePct);
        if (prevRange > 0 && curRange <= prevRange * compressionRatio) return "compression";
    }
    return "range_continuation";
}

function generateSubBoxCandidate(subBoxes: any[], parentBox: any, data: any[], watchDays: number = 7, proximityRatio: number = 0.2, compressionRatio: number = 0.75) {
    if (parentBox.result !== "ACTIVE" && parentBox.result !== "BEAR_ACTIVE" && parentBox.result !== "BULL_ACTIVE") return null;
    
    const activeBoxes = subBoxes.filter(b => b.is_completed === 0);
    if (activeBoxes.length === 0) return null;
    
    const latest = activeBoxes.reduce((max, b) => b.endX > max.endX ? b : max, activeBoxes[0]);
    if (data.length === 0) return null;
    const last = data.reduce((max, p) => p.x > max.x ? p : max, data[0]);
    
    const ordered = [...subBoxes].sort((a, b) => a.subBoxIndex - b.subBoxIndex);
    const latestIdx = ordered.indexOf(latest) >= 0 ? ordered.indexOf(latest) : ordered.length - 1;
    const previous = latestIdx > 0 ? ordered[latestIdx - 1] : null;
    const currentClose = Number(last.close);
    
    const role = candidateRole(latest, currentClose, previous, proximityRatio, compressionRatio);
    const candidateIndex = Number(latest.subBoxIndex) + 1;
    const startX = Number(last.x) + 1;
    const endX = startX + Math.max(watchDays, 1) - 1;
    
    return {
        layer: SUB_BOX_LAYER,
        scope: SUB_BOX_SCOPE,
        parentBoxIndex: Number(parentBox.box_index || parentBox.boxIndex),
        parentPhase: parentBox.phase,
        parentResult: parentBox.result,
        subBoxIndex: candidateIndex,
        subBoxLabel: subBoxLabel(candidateIndex),
        startX,
        endX,
        upper: Number(latest.upper),
        lower: Number(latest.lower),
        breakoutUpLevel: Number(latest.breakoutUpLevel),
        breakdownLevel: Number(latest.breakdownLevel),
        scenarioRole: role,
        source: "heuristic",
        visibility: "default",
        is_prediction: 1,
        is_completed: 0,
        validUntilDay: endX,
        invalidatedBy: "upper/lower watch level break"
    };
}

function buildSubBoxPayload(cycleData: any[], cycleZones: any[]) {
    if (cycleData.length === 0) return [[], []];
    const latestDay = Math.max(...cycleData.map(p => p.x));
    
    let allObserved: any[] = [];
    let allCandidates: any[] = [];
    
    const realZones = cycleZones.filter(z => z.is_prediction === 0);
    
    realZones.forEach(zone => {
        const rawEndX = Number(zone.endX || zone.end_x || latestDay);
        const parent = {
            box_index: Number(zone.boxIndex || zone.box_index),
            phase: zone.phase,
            result: zone.result,
            start_x: Number(zone.startX || zone.start_x),
            end_x: rawEndX > 0 ? Math.min(rawEndX, latestDay) : latestDay
        };
        
        // Force result to ACTIVE so detectSubBoxes processes all historical boxes too
        const forcedParent = { ...parent, result: "ACTIVE" };
        
        const observed = detectSubBoxes(cycleData, forcedParent, 5, 0.75);
        allObserved.push(...observed);
        
        // Only generate candidates for currently active zones
        const isActuallyActive = zone.is_completed === 0 && (zone.result || "").toUpperCase().includes("ACTIVE");
        if (isActuallyActive) {
            const candidate = generateSubBoxCandidate(observed, forcedParent, cycleData, 7);
            if (candidate) allCandidates.push(candidate);
        }
    });
    
    return [allObserved, allCandidates];
}

function applyActiveBoxDisplayFromFirstPred(cycleZones: any[]) {
    if (!cycleZones || cycleZones.length === 0) return cycleZones;
    const firstPred = cycleZones.find(z => z.is_prediction === 1);
    if (!firstPred) return cycleZones;
    
    const firstPhase = (firstPred.phase || "").toUpperCase();
    if (firstPhase !== "BEAR" && firstPhase !== "BULL") return cycleZones;
    
    const activeResult = firstPhase === "BEAR" ? "BEAR_ACTIVE" : "BULL_ACTIVE";
    return cycleZones.map(zone => {
        if (zone.is_completed === 0 && zone.is_prediction === 0) {
            return { ...zone, phase: firstPhase, result: activeResult };
        }
        return zone;
    });
}

async function fetchAllRows(query: any) {
    let allData: any[] = [];
    let from = 0;
    const limit = 1000;
    while (true) {
        const { data, error } = await query.range(from, from + limit - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < limit) break;
        from += limit;
    }
    return allData;
}

// Memory caches
let manifestCache: any = null;
let defaultCoinId: string | null = null;
let defaultCycleNumber: number | null = null;

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export async function fetchDashboardManifest() {
    if (manifestCache) {
        return {
            data_version: "frontend-v1",
            generated_at: new Date().toISOString(),
            cache_status: "hit",
            ...manifestCache
        };
    }

    try {
        const res = await fetch(`${BASE_URL}/api/dashboard-manifest`);
        if (res.ok) {
            const data = await res.json();
            manifestCache = {
                default_coin_id: data.default_coin_id,
                default_cycle_number: data.default_cycle_number,
                coins: data.coins
            };
            defaultCoinId = data.default_coin_id;
            defaultCycleNumber = data.default_cycle_number;
            return data;
        }
    } catch (e) {
        console.warn('Backend manifest API unreachable, falling back:', e);
    }

    if (!isSupabaseConfigured) {
        const sampleData = await getSampleData();
        const coins = Object.keys(sampleData).map((coinKey, idx) => {
            const coinObj = sampleData[coinKey];
            return {
                coin_id: coinKey,
                symbol: (coinObj.symbol || coinKey).toUpperCase(),
                name: coinObj.name || coinKey,
                rank: coinObj.rank || (idx + 1),
                cycles: (coinObj.cycles || []).map((c: any) => ({
                    cycle_number: c.cycle_number,
                    cycle_name: c.cycle_name,
                    peak_date: c.peak_date,
                    peak_price: c.peak_price,
                    has_data: true,
                    can_lazy_load: true,
                    is_current: c.cycle_number === 4,
                    is_initially_loaded: true,
                }))
            };
        });
        defaultCoinId = "bitcoin";
        defaultCycleNumber = 4;
        manifestCache = {
            default_coin_id: defaultCoinId,
            default_cycle_number: defaultCycleNumber,
            coins
        };
        return {
            data_version: "sample-v1",
            generated_at: new Date().toISOString(),
            cache_status: "sample",
            ...manifestCache
        };
    }

    const [coinsRes, summaryRes] = await Promise.all([
        fetchAllRows(supabase.from('coins').select('id, symbol, name, rank').order('rank')),
        fetchAllRows(supabase.from('alt_cycle_summary').select('coin_id, cycle_number, cycle_name, peak_date, peak_price').order('coin_id').order('cycle_number'))
    ]);

    const coinsRows = coinsRes;
    const summaryRows = summaryRes;

    const manifestCoins = coinsRows.map((coin: any) => {
        const coinCycles = summaryRows
            .filter((r: any) => r.coin_id === coin.id)
            .map((r: any) => ({
                cycle_number: r.cycle_number,
                cycle_name: r.cycle_name,
                peak_date: r.peak_date,
                peak_price: r.peak_price,
                has_data: true, // We assume true for lazy loading
                can_lazy_load: true
            }))
            .sort((a: any, b: any) => a.cycle_number - b.cycle_number);

        // Calculate current cycle (highest number or named 'current')
        let currentCycleNumber = Math.max(...coinCycles.map((c: any) => c.cycle_number));
        const currentByName = coinCycles.find((c: any) => String(c.cycle_name).toLowerCase().includes("current"));
        if (currentByName) currentCycleNumber = currentByName.cycle_number;

        return {
            coin_id: coin.id,
            symbol: (coin.symbol || "").toUpperCase(),
            name: coin.name,
            rank: coin.rank,
            cycles: coinCycles.map((c: any) => ({
                ...c,
                is_current: c.cycle_number === currentCycleNumber,
                is_initially_loaded: false // will be set below
            }))
        };
    });

    const btcCoin = manifestCoins.find((c: any) => c.symbol === "BTC");
    defaultCoinId = btcCoin ? btcCoin.coin_id : (manifestCoins.length > 0 ? manifestCoins[0].coin_id : null);
    
    if (defaultCoinId) {
        const defCoin = manifestCoins.find((c: any) => c.coin_id === defaultCoinId);
        if (defCoin && defCoin.cycles.length > 0) {
            defaultCycleNumber = Math.max(...defCoin.cycles.map((c: any) => c.cycle_number));
            const currentByName = defCoin.cycles.find((c: any) => String(c.cycle_name).toLowerCase().includes("current"));
            if (currentByName) defaultCycleNumber = currentByName.cycle_number;
            
            defCoin.cycles.forEach((c: any) => {
                if (c.cycle_number === defaultCycleNumber) {
                    c.is_initially_loaded = true;
                }
            });
        }
    }

    manifestCache = {
        default_coin_id: defaultCoinId,
        default_cycle_number: defaultCycleNumber,
        coins: manifestCoins
    };

    return {
        data_version: "frontend-v1",
        generated_at: new Date().toISOString(),
        cache_status: "miss",
        ...manifestCache
    };
}

export async function fetchDashboardInitialData() {
    try {
        const res = await fetch(`${BASE_URL}/api/dashboard-initial-data`);
        if (res.ok) {
            const data = await res.json();
            return data;
        }
    } catch (e) {
        console.warn('Backend initial data API unreachable, falling back:', e);
    }

    if (!manifestCache) {
        await fetchDashboardManifest();
    }

    if (!isSupabaseConfigured) {
        const sampleData = await getSampleData();
        return {
            data_version: "sample-v1",
            generated_at: new Date().toISOString(),
            cache_status: "sample",
            data: sampleData
        };
    }

    const initialData: Record<string, any> = {};

    for (const coin of manifestCache.coins) {
        initialData[coin.coin_id] = {
            symbol: coin.symbol,
            name: coin.name,
            rank: coin.rank,
            cycles: []
        };
        
        if (coin.coin_id === defaultCoinId && defaultCycleNumber) {
            // Fetch this specific cycle
            const cyclePayload = await fetchCycleData(defaultCoinId, defaultCycleNumber);
            initialData[coin.coin_id].cycles = [cyclePayload.cycle];
        }
    }

    return {
        data_version: "frontend-v1",
        generated_at: new Date().toISOString(),
        cache_status: "miss",
        data: initialData
    };
}

export async function fetchCycleData(coinId: string, cycleNumber: number) {
    try {
        const res = await fetch(
            `${BASE_URL}/api/dashboard-cycle-data?coin_id=${encodeURIComponent(coinId)}&cycle_number=${cycleNumber}`,
        );
        if (res.ok) {
            const data = await res.json();
            return data;
        }
    } catch (e) {
        console.warn('Backend cycle data API unreachable, falling back:', e);
    }

    if (!isSupabaseConfigured) {
        const sampleData = await getSampleData();
        const coin = sampleData[coinId] || Object.values(sampleData).find((c: any) => (c.symbol || '').toLowerCase() === coinId.toLowerCase());
        const cycle = coin?.cycles?.find((c: any) => c.cycle_number === cycleNumber);
        return {
            data_version: "sample-v1",
            generated_at: new Date().toISOString(),
            cache_status: "sample",
            coin_id: coinId,
            cycle: cycle || null
        };
    }

    const [cycleRows, boxRows, pathRows, peakRows] = await Promise.all([
        fetchAllRows(supabase.from('alt_cycle_data').select('*').eq('coin_id', coinId).eq('cycle_number', cycleNumber).order('days_since_peak')),
        fetchAllRows(supabase.from('coin_analysis_results').select('*').eq('coin_id', coinId).eq('cycle_number', cycleNumber).order('box_index')),
        fetchAllRows(supabase.from('coin_prediction_paths').select('*').eq('coin_id', coinId).eq('cycle_number', cycleNumber).order('scenario').order('day_x')),
        fetchAllRows(supabase.from('coin_prediction_peaks').select('*').eq('coin_id', coinId).eq('cycle_number', cycleNumber))
    ]);

    const data = (cycleRows || []).map((row: any) => ({
        x: Number(row.days_since_peak || 0),
        close: Number(Number(row.close_rate || 0).toFixed(4)),
        high: Number(Number(row.high_rate || 0).toFixed(4)),
        low: Number(Number(row.low_rate || 0).toFixed(4)),
        date: String(row.timestamp || "").substring(0, 10)
    }));

    let rawZones = (boxRows || []).map((row: any) => ({
        boxIndex: Number(row.box_index || 0),
        startX: row.start_x,
        endX: row.end_x,
        hi: row.hi,
        lo: row.lo,
        hiDay: row.hi_day,
        loDay: row.lo_day,
        duration: row.duration,
        rangePct: Number(row.range_pct || 0).toFixed(1),
        phase: row.phase,
        result: row.result,
        is_prediction: row.is_prediction,
        is_completed: row.is_completed,
        rise_days: row.rise_days,
        decline_days: row.decline_days
    }));

    const cycleZones = applyActiveBoxDisplayFromFirstPred(rawZones);

    const paths = pathRows || [];
    const predictionPaths = {
        bull: paths.filter((p: any) => String(p.scenario).toLowerCase() === 'bull').map((p: any) => ({ x: p.day_x, value: p.value })),
        bear: paths.filter((p: any) => String(p.scenario).toLowerCase() === 'bear').map((p: any) => ({ x: p.day_x, value: p.value }))
    };

    const peakPredictions = (peakRows || []).map((row: any) => ({
        type: row.peak_type,
        value: row.predicted_value,
        day_x: row.predicted_day
    }));

    const [subBoxes, subBoxCandidates] = buildSubBoxPayload(data, cycleZones);

    const cycleName = cycleRows?.[0]?.cycle_name || `Cycle ${cycleNumber}`;
    const peakDate = cycleRows?.[0]?.peak_date || "";
    const peakPrice = cycleRows?.[0]?.peak_price || null;

    return {
        data_version: "frontend-v1",
        generated_at: new Date().toISOString(),
        cache_status: "miss",
        coin_id: coinId,
        cycle: {
            cycle_number: cycleNumber,
            cycle_name: cycleName,
            peak_date: peakDate,
            peak_price: peakPrice,
            data,
            box_zones: cycleZones,
            prediction_paths: predictionPaths,
            peak_predictions: peakPredictions,
            sub_boxes: subBoxes,
            sub_box_candidates: subBoxCandidates
        }
    };
}
