const typeColors = {
    fire: '#F08030', water: '#6890F0', grass: '#78C850', electric: '#F8D030',
    ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0', ground: '#E0C068',
    flying: '#A890F0', psychic: '#F85888', bug: '#A8B820', rock: '#B8A038',
    ghost: '#705898', dragon: '#7038F8', dark: '#705848', steel: '#B8B8D0',
    fairy: '#EE99AC', normal: '#A8A878'
};

const detailsContainer = document.getElementById('pokemon-details');
const audioPlayer = document.getElementById('pokemon-cry');
const versionContainer = document.getElementById('version-selector-container');
const versionSelect = document.getElementById('game-version-select');

const urlParams = new URLSearchParams(window.location.search);
const pokemonId = urlParams.get('id');

// Estados globais da página de detalhes
let currentPokemonData = null;
let currentEncountersData = [];
let currentEvolutionChain = [];
let availableVersions = [];
let selectedVersion = "";
let selectedMoveMethod = "all"; // 'all', 'level-up' ou 'machine'
let showShiny = false;

async function fetchPokemonDetails() {
    if (!pokemonId) {
        detailsContainer.innerHTML = '<p class="loading">Nenhum Pokémon selecionado.</p>';
        return;
    }

    try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
        currentPokemonData = await res.json();

        const encounterRes = await fetch(currentPokemonData.location_area_encounters);
        currentEncountersData = await encounterRes.json();

        const damageRelations = await calculateWeaknesses(currentPokemonData.types);

        try {
            const speciesRes = await fetch(currentPokemonData.species.url);
            const speciesData = await speciesRes.json();
            const evolutionRes = await fetch(speciesData.evolution_chain.url);
            const evolutionData = await evolutionRes.json();
            currentEvolutionChain = await parseEvolutionChainDetails(evolutionData.chain);
        } catch (e) {
            currentEvolutionChain = [];
        }

        buildVersionList();
        renderPage(damageRelations);

    } catch (error) {
        detailsContainer.innerHTML = '<p class="loading">Erro crítico ao processar dados avançados.</p>';
    }
}

async function calculateWeaknesses(types) {
    const totalRelations = {};
    Object.keys(typeColors).forEach(type => totalRelations[type] = 1.0);
    for (const typeSlot of types) {
        const res = await fetch(typeSlot.type.url);
        const typeData = await res.json();
        typeData.damage_relations.double_damage_from.forEach(t => totalRelations[t.name] *= 2.0);
        typeData.damage_relations.half_damage_from.forEach(t => totalRelations[t.name] *= 0.5);
        typeData.damage_relations.no_damage_from.forEach(t => totalRelations[t.name] *= 0.0);
    }
    return totalRelations;
}

async function parseEvolutionChainDetails(chainNode) {
    let parts = [];
    let current = chainNode;

    while (current) {
        const name = current.species.name;
        let img = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png';
        let id = null;
        let triggerInfo = "Forma Inicial";

        try {
            const pRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
            const pData = await pRes.json();
            id = pData.id;
            img = pData.sprites.other['official-artwork'].front_default || pData.sprites.front_default;
        } catch (e) {}

        if (current.evolution_details && current.evolution_details.length > 0) {
            const details = current.evolution_details[0];
            if (details.trigger.name === 'level-up') {
                triggerInfo = details.min_level ? `Nv. ${details.min_level}` : "Level Up";
                if (details.min_happiness) triggerInfo += " + Felicidade";
                if (details.known_move_type) triggerInfo += ` + Golpe ${details.known_move_type.name}`;
            } else if (details.trigger.name === 'use-item') {
                triggerInfo = `${details.item.name.replace(/-/g, ' ')}`;
            } else if (details.trigger.name === 'trade') {
                triggerInfo = "Troca (Trade)";
                if (details.held_item) triggerInfo += ` com ${details.held_item.name.replace(/-/g, ' ')}`;
            } else {
                triggerInfo = details.trigger.name.replace(/-/g, ' ');
            }
        }

        parts.push({ name, id, img, trigger: triggerInfo });
        current = current.evolves_to[0];
    }
    return parts;
}

function buildVersionList() {
    const versionsSet = new Set();
    currentPokemonData.moves.forEach(m => {
        m.version_group_details.forEach(vg => versionsSet.add(vg.version_group.name));
    });
    availableVersions = Array.from(versionsSet).sort();
    
    if (availableVersions.length > 0) {
        if (!selectedVersion || !availableVersions.includes(selectedVersion)) {
            selectedVersion = availableVersions[availableVersions.length - 1];
        }
        versionSelect.innerHTML = availableVersions.map(v => 
            `<option value="${v}" ${v === selectedVersion ? 'selected' : ''}>${v.replace(/-/g, ' ')}</option>`
        ).join('');
        versionContainer.classList.remove('hidden');
    }
}

versionSelect.addEventListener('change', (e) => {
    selectedVersion = e.target.value;
    document.getElementById('location-dynamic-area').innerHTML = renderLocationsBlock();
    document.getElementById('moves-dynamic-area').innerHTML = renderMovesBlock();
});

window.filterMovesMethod = function(method) {
    selectedMoveMethod = method;
    document.getElementById('btn-move-all').classList.toggle('active', method === 'all');
    document.getElementById('btn-move-lvl').classList.toggle('active', method === 'level-up');
    document.getElementById('btn-move-tm').classList.toggle('active', method === 'machine');
    document.getElementById('moves-table-wrapper').innerHTML = renderMovesTableOnly();
};

window.toggleSpriteMode = function(mode) {
    showShiny = (mode === 'shiny');
    document.getElementById('btn-normal').classList.toggle('active', !showShiny);
    document.getElementById('btn-shiny').classList.toggle('active', showShiny);
    
    const artworkUrl = showShiny 
        ? (currentPokemonData.sprites.other['official-artwork'].front_shiny || currentPokemonData.sprites.front_shiny)
        : (currentPokemonData.sprites.other['official-artwork'].front_default || currentPokemonData.sprites.front_default);
        
    document.getElementById('main-pokemon-image').src = artworkUrl || 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png';
};

window.playCry = function() {
    audioPlayer.play().catch(e => console.log("Áudio indisponível"));
};

function renderLocationsBlock() {
    const gameLocations = currentEncountersData.filter(encounter => 
        encounter.version_details.some(vd => selectedVersion.includes(vd.version.name) || vd.version.name.includes(selectedVersion))
    );

    if (gameLocations.length === 0) {
        return `<p style="color: var(--text-muted); font-size:0.9rem;">Não capturável de forma selvagem nesta versão.</p>`;
    }

    return `
        <ul class="location-list">
            ${gameLocations.slice(0, 5).map(loc => `<li>${loc.location_area.name.replace(/-/g, ' ')}</li>`).join('')}
            ${gameLocations.length > 5 ? `<li style="border-left-color: #777; font-size:0.85rem;">...e mais ${gameLocations.length - 5} locais.</li>` : ''}
        </ul>
    `;
}

function renderMovesBlock() {
    return `
        <div class="sprite-toggle-container" style="justify-content: flex-start; margin-bottom: 15px;">
            <button id="btn-move-all" class="toggle-btn active" onclick="filterMovesMethod('all')">Todos</button>
            <button id="btn-move-lvl" class="toggle-btn" onclick="filterMovesMethod('level-up')">Level Up</button>
            <button id="btn-move-tm" class="toggle-btn" onclick="filterMovesMethod('machine')">TMs / HMs</button>
        </div>
        <div id="moves-table-wrapper">
            ${renderMovesTableOnly()}
        </div>
    `;
}

function renderMovesTableOnly() {
    const currentMoves = [];

    currentPokemonData.moves.forEach(moveEntry => {
        const matchVersion = moveEntry.version_group_details.find(vg => vg.version_group.name === selectedVersion);
        
        if (matchVersion) {
            const method = matchVersion.move_learn_method.name;
            const level = matchVersion.level_learned_at;
            
            const matchesFilter = (selectedMoveMethod === 'all' && (method === 'level-up' || method === 'machine')) || 
                                  (selectedMoveMethod === method);

            if (matchesFilter) {
                currentMoves.push({
                    name: moveEntry.move.name.replace(/-/g, ' '),
                    method: method === 'level-up' ? 'Level' : 'TM/HM',
                    level: level,
                    rawMethod: method
                });
            }
        }
    });

    if (currentMoves.length === 0) {
        return `<p style="color: var(--text-muted); font-size:0.9rem; padding: 10px 0;">Nenhum golpe encontrado para este filtro nesta versão do jogo.</p>`;
    }

    currentMoves.sort((a, b) => {
        if (a.rawMethod !== b.rawMethod) return a.rawMethod === 'level-up' ? -1 : 1;
        return a.level - b.level;
    });

    return `
        <table class="moves-table">
            <thead>
                <tr>
                    <th>Golpe</th>
                    <th>Método</th>
                    <th>Requisito</th>
                </tr>
            </thead>
            <tbody>
                ${currentMoves.map(m => `
                    <tr>
                        <td style="font-weight:600; color:#fff;">${m.name}</td>
                        <td><span class="move-method-badge ${m.rawMethod === 'level-up' ? 'method-level' : 'method-machine'}">${m.method}</span></td>
                        <td>${m.rawMethod === 'level-up' ? `Nv. ${m.level}` : 'Item TM/HM'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderPage(damageRelations) {
    const { name, id, height, weight, sprites, types, stats } = currentPokemonData;
    
    const cryUrl = sprites.cries?.latest || sprites.cries?.legacy || "";
    audioPlayer.src = cryUrl;

    const defaultImg = sprites.other['official-artwork'].front_default || sprites.front_default;
    const typesHTML = types.map(t => `<span class="type-badge" style="background-color: ${typeColors[t.type.name]}">${t.type.name}</span>`).join('');

    // --- NOVA LÓGICA: Calcula o total dos atributos ---
    const totalStatsValue = stats.reduce((sum, currentStat) => sum + currentStat.base_stat, 0);

    const statStyles = { hp: '#ff4f4f', attack: '#f57322', defense: '#f5c422', 'special-attack': '#4facfe', 'special-defense': '#38ef7d', speed: '#f34fbb' };
    const statsHTML = stats.map(s => {
        const percentage = Math.min((s.base_stat / 200) * 100, 100);
        return `
            <div class="stat-row">
                <span class="stat-name">${s.stat.name.replace('special-', 'sp. ')}</span>
                <span class="stat-value">${s.base_stat}</span>
                <div class="stat-bar-container"><div class="stat-bar" style="width: ${percentage}%; background-color: ${statStyles[s.stat.name] || '#777'}"></div></div>
            </div>
        `;
    }).join('');

    let weaknessesHTML = '', resistancesHTML = '', immunitiesHTML = '';
    Object.entries(damageRelations).forEach(([typeName, multiplier]) => {
        if (multiplier === 1.0) return;
        const badge = `<div class="damage-badge-wrapper"><span class="type-badge" style="background-color: ${typeColors[typeName]}">${typeName}</span><span class="damage-multiplier ${multiplier > 1 ? 'weak' : multiplier < 1 && multiplier > 0 ? 'resist' : 'immune'}">${multiplier}x</span></div>`;
        if (multiplier > 1) weaknessesHTML += badge;
        else if (multiplier < 1 && multiplier > 0) resistancesHTML += badge;
        else if (multiplier === 0) immunitiesHTML += badge;
    });

    let evolutionsHTML = '';
    if (currentEvolutionChain.length > 0) {
        evolutionsHTML = currentEvolutionChain.map((evo, index) => {
            const isCurrent = evo.id === id ? 'style="border-color: var(--primary); background: #26262b;"' : '';
            const link = evo.id 
                ? `<a href="detalhes.html?id=${evo.id}" class="evolution-step" ${isCurrent}>
                    <img src="${evo.img}" alt="${evo.name}">
                    <span>${evo.name}</span>
                    <span class="evolution-trigger">${evo.trigger}</span>
                   </a>`
                : `<div class="evolution-step"><span>${evo.name}</span><span class="evolution-trigger">${evo.trigger}</span></div>`;
            const arrow = (index < currentEvolutionChain.length - 1) ? '<span class="evolution-arrow">→</span>' : '';
            return link + arrow;
        }).join('');
    } else {
        evolutionsHTML = '<p style="color:var(--text-muted);">Forma única ou variante alternativa sem cadeia linear mapeada.</p>';
    }

    detailsContainer.innerHTML = `
        <span class="pokemon-id">Nº ${id}</span>
        <h2 class="pokemon-name">${name.replace(/-/g, ' ')}</h2>
        <div class="types-container">${typesHTML}</div>
        
        ${cryUrl ? `<button class="cry-btn" onclick="playCry()">🔊 Ouvir Grito Original</button>` : ''}
        
        <div class="sprite-toggle-container">
            <button id="btn-normal" class="toggle-btn active" onclick="toggleSpriteMode('normal')">Versão Normal</button>
            <button id="btn-shiny" class="toggle-btn" onclick="toggleSpriteMode('shiny')">✨ Versão Shiny</button>
        </div>

        <img id="main-pokemon-image" class="detail-img" src="${defaultImg}" alt="${name}">
        
        <div class="info-section">
            <h3>Atributos Base (Stats)</h3>
            <div style="margin-top: 12px;">
                ${statsHTML}
                <div class="stat-row" style="margin-top: 16px; padding-top: 12px; border-top: 1px dashed var(--border-color); font-weight: bold;">
                    <span class="stat-name" style="color: #ffffff;">TOTAL</span>
                    <span class="stat-value" style="color: var(--primary); width: auto; text-align: left; padding-left: 5px;">${totalStatsValue}</span>
                </div>
            </div>
        </div>

        <div class="info-section">
            <h3>Eficácia de Dano Sofrido</h3>
            ${weaknessesHTML ? `<div class="damage-group"><div class="damage-group-title">Fraquezas:</div><div class="damage-badges-grid">${weaknessesHTML}</div></div>` : ''}
            ${resistancesHTML ? `<div class="damage-group"><div class="damage-group-title">Resistências:</div><div class="damage-badges-grid">${resistancesHTML}</div></div>` : ''}
            ${immunitiesHTML ? `<div class="damage-group"><div class="damage-group-title">Imunidades:</div><div class="damage-badges-grid">${immunitiesHTML}</div></div>` : ''}
        </div>

        <div class="info-section">
            <h3>Medidas Gerais</h3>
            <div class="specs-grid">
                <p><strong>Altura:</strong> ${(height / 10).toFixed(1)} m</p>
                <p><strong>Peso:</strong> ${(weight / 10).toFixed(1)} kg</p>
            </div>
        </div>

        <div class="info-section">
            <h3>Linha de Evolução e Requisitos</h3>
            <div class="evolution-chain-container">${evolutionsHTML}</div>
        </div>

        <div class="info-section">
            <h3>Onde Capturar (Selvagem)</h3>
            <div id="location-dynamic-area" style="margin-top: 10px;">
                ${renderLocationsBlock()}
            </div>
        </div>

        <div class="info-section">
            <h3>Lista de Ataques Aprendidos</h3>
            <div id="moves-dynamic-area" style="margin-top: 10px;">
                ${renderMovesBlock()}
            </div>
        </div>
    `;
}

fetchPokemonDetails();