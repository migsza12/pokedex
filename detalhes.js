const typeColors = {
    fire: '#F08030', water: '#6890F0', grass: '#78C850', electric: '#F8D030',
    ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0', ground: '#E0C068',
    flying: '#A890F0', psychic: '#F85888', bug: '#A8B820', rock: '#B8A038',
    ghost: '#705898', dragon: '#7038F8', dark: '#705848', steel: '#B8B8D0',
    fairy: '#EE99AC', normal: '#A8A878'
};

const detailsContainer = document.getElementById('pokemon-details');
const pageWrapper = document.getElementById('detail-page-wrapper');
const audioPlayer = document.getElementById('pokemon-cry');

const urlParams = new URLSearchParams(window.location.search);
const pokemonId = urlParams.get('id');

async function fetchPokemonDetails() {
    if (!pokemonId) {
        detailsContainer.innerHTML = '<p>Nenhum Pokémon selecionado.</p>';
        return;
    }

    try {
        // 1. Coleta dados do Pokémon base
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
        const pokemon = await res.json();

        // 2. Define o fundo dinâmico com base no tipo principal do Pokémon
        const primaryType = pokemon.types[0].type.name;
        const mainColor = typeColors[primaryType] || '#1e1e24';
        pageWrapper.style.backgroundColor = `${mainColor}22`; // Adiciona transparência em Hex (22)

        // 3. Coleta os dados das fraquezas e vantagens (Tabela de Tipos)
        const damageRelations = await calculateWeaknesses(pokemon.types);

        // 4. Coleta os dados da cadeia evolutiva de forma segura
        let evolutionSpecs = [];
        try {
            const speciesRes = await fetch(pokemon.species.url);
            const speciesData = await speciesRes.json();
            const evolutionRes = await fetch(speciesData.evolution_chain.url);
            const evolutionData = await evolutionRes.json();
            const evolutionNames = parseEvolutions(evolutionData.chain);

            evolutionSpecs = await Promise.all(evolutionNames.map(async (name) => {
                try {
                    const pRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
                    const pData = await pRes.json();
                    return {
                        name, id: pData.id,
                        img: pData.sprites.front_default || pData.sprites.other['official-artwork'].front_default
                    };
                } catch (e) {
                    return { name, id: null, img: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png' };
                }
            }));
        } catch (e) { /* Trata espécies sem cadeias lineares (Megas) */ }

        renderDetails(pokemon, evolutionSpecs, damageRelations);

    } catch (error) {
        detailsContainer.innerHTML = '<p>Erro ao carregar detalhes do Pokémon.</p>';
    }
}

// CALCULA MATEMATICAMENTE AS FRAQUEZAS, RESISTÊNCIAS E IMUNIDADES (Suporta tipo duplo)
async function calculateWeaknesses(types) {
    // Inicializa todos os tipos do jogo com multiplicador neutro de dano (1x)
    const totalRelations = {};
    Object.keys(typeColors).forEach(type => totalRelations[type] = 1.0);

    // Faz requisições para os tipos que o Pokémon possui e multiplica suas fraquezas
    for (const typeSlot of types) {
        const res = await fetch(typeSlot.type.url);
        const typeData = await res.json();

        // Alvos que dão 2x de dano neste tipo
        typeData.damage_relations.double_damage_from.forEach(t => totalRelations[t.name] *= 2.0);
        // Alvos que dão 0.5x de dano neste tipo
        typeData.damage_relations.half_damage_from.forEach(t => totalRelations[t.name] *= 0.5);
        // Alvos que dão 0x de dano (Imunidade)
        typeData.damage_relations.no_damage_from.forEach(t => totalRelations[t.name] *= 0.0);
    }

    return totalRelations;
}

function parseEvolutions(chain) {
    let evoChain = [];
    let current = chain;
    while (current) {
        evoChain.push(current.species.name);
        current = current.evolves_to[0];
    }
    return evoChain;
}

// Dispara o som original mapeado pela API
window.playCry = function() {
    audioPlayer.play().catch(e => console.log("Áudio bloqueado pelas políticas do navegador"));
};

function renderDetails(pokemon, evolutions, damageRelations) {
    const { name, id, height, weight, sprites, types, stats, moves } = pokemon;
    
    // Configura o player de som com o arquivo .mp3 oficial retornado pela PokeAPI
    const cryUrl = sprites.cries?.latest || sprites.cries?.legacy || "";
    audioPlayer.src = cryUrl;

    const imageUrl = sprites.other['official-artwork'].front_default || sprites.front_default;
    const typesHTML = types.map(t => `<span class="type-badge" style="background-color: ${typeColors[t.type.name]}">${t.type.name}</span>`).join('');
    const limitedMoves = moves.slice(0, 6).map(m => `<li>${m.move.name.replace(/-/g, ' ')}</li>`).join('');

    // 1. MONTA O HTML DOS STATUS BASE (BARRA DE PROGRESSO COLORIDA)
    // Mapeamento simples de rótulos e cores para as barras
    const statStyles = {
        hp: '#ff4f4f', attack: '#f57322', defense: '#f5c422',
        'special-attack': '#4facfe', 'special-defense': '#38ef7d', speed: '#f34fbb'
    };

    const statsHTML = stats.map(s => {
        const percentage = Math.min((s.base_stat / 200) * 100, 100); // 200 como teto máximo para cálculo de proporção visual
        const barColor = statStyles[s.stat.name] || '#777';
        return `
            <div class="stat-row">
                <span class="stat-name">${s.stat.name.replace('special-', 'sp. ')}</span>
                <span class="stat-value">${s.base_stat}</span>
                <div class="stat-bar-container">
                    <div class="stat-bar" style="width: ${percentage}%; background-color: ${barColor}"></div>
                </div>
            </div>
        `;
    }).join('');

    // 2. MONTA O HTML SEPARADO POR CONTROLE DE DANOS (FRAQUEZAS E RESISTÊNCIAS)
    let weaknessesHTML = '';
    let resistancesHTML = '';
    let immunitiesHTML = '';

    Object.entries(damageRelations).forEach(([typeName, multiplier]) => {
        const color = typeColors[typeName];
        const badgeElement = `
            <div class="damage-badge-wrapper">
                <span class="type-badge" style="background-color: ${color}">${typeName}</span>
                <span class="damage-multiplier ${multiplier > 1 ? 'weak' : multiplier < 1 && multiplier > 0 ? 'resist' : 'immune'}">${multiplier}x</span>
            </div>
        `;

        if (multiplier > 1) weaknessesHTML += badgeElement;
        else if (multiplier < 1 && multiplier > 0) resistancesHTML += badgeElement;
        else if (multiplier === 0) immunitiesHTML += badgeElement;
    });

    // 3. CADEIA EVOLUTIVA
    let evolutionsHTML = '';
    if(evolutions.length > 0) {
        evolutionsHTML = evolutions.map((evo, index) => {
            const isCurrent = evo.id === id ? 'style="border-color: var(--primary); background: #29292e;"' : '';
            const linkHTML = evo.id 
                ? `<a href="detalhes.html?id=${evo.id}" class="evolution-step" ${isCurrent}>
                    <img src="${evo.img}" alt="${evo.name}">
                    <span>${evo.name}</span>
                   </a>`
                : `<div class="evolution-step"><span>${evo.name}</span></div>`;
                
            const arrow = (index < evolutions.length - 1) ? '<span class="evolution-arrow">→</span>' : '';
            return linkHTML + arrow;
        }).join('');
    } else {
        evolutionsHTML = '<p style="color:var(--text-muted); font-size:0.9rem;">Dados de linhagem indisponíveis.</p>';
    }

    detailsContainer.innerHTML = `
        <span class="pokemon-id">Nº ${id}</span>
        <h2 class="pokemon-name" style="font-size: 2.2rem; margin-bottom:5px; text-transform: capitalize;">${name.replace(/-/g, ' ')}</h2>
        
        <div class="types-container">${typesHTML}</div>
        
        ${cryUrl ? `<button class="cry-btn" onclick="playCircle || playCry()">🔊 Ouvir Grito original</button>` : ''}
        
        <img class="detail-img" src="${imageUrl}" alt="${name}">
        
        <div class="info-section">
            <h3>Atributos Base (Stats)</h3>
            <div style="margin-top: 10px;">
                ${statsHTML}
            </div>
        </div>

        <div class="info-section">
            <h3>Eficácia de Dano Sofrido</h3>
            
            ${weaknessesHTML ? `
                <div class="damage-group">
                    <div class="damage-group-title">Fraquezas (Toma mais dano):</div>
                    <div class="damage-badges-grid">${weaknessesHTML}</div>
                </div>
            ` : ''}

            ${resistancesHTML ? `
                <div class="damage-group">
                    <div class="damage-group-title">Resistências (Toma menos dano):</div>
                    <div class="damage-badges-grid">${resistancesHTML}</div>
                </div>
            ` : ''}

            ${immunitiesHTML ? `
                <div class="damage-group">
                    <div class="damage-group-title">Imunidades (Dano Zero):</div>
                    <div class="damage-badges-grid">${immunitiesHTML}</div>
                </div>
            ` : ''}
        </div>

        <div class="info-section">
            <h3>Medidas</h3>
            <p style="margin-bottom: 6px;"><strong>Altura:</strong> ${(height / 10).toFixed(1)} m</p>
            <p><strong>Peso:</strong> ${(weight / 10).toFixed(1)} kg</p>
        </div>

        <div class="info-section">
            <h3>Linha de Evolução</h3>
            <div class="evolution-chain-container">
                ${evolutionsHTML}
            </div>
        </div>

        <div class="info-section">
            <h3>Golpes Principais</h3>
            <ul class="moves-grid">
                ${limitedMoves || '<li>Nenhum golpe listado</li>'}
            </ul>
        </div>
    `;
}

fetchPokemonDetails();