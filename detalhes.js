const typeColors = {
    fire: '#F08030', water: '#6890F0', grass: '#78C850', electric: '#F8D030',
    ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0', ground: '#E0C068',
    flying: '#A890F0', psychic: '#F85888', bug: '#A8B820', rock: '#B8A038',
    ghost: '#705898', dragon: '#7038F8', dark: '#705848', steel: '#B8B8D0',
    fairy: '#EE99AC', normal: '#A8A878'
};

const detailsContainer = document.getElementById('pokemon-details');
const urlParams = new URLSearchParams(window.location.search);
const pokemonId = urlParams.get('id');

async function fetchPokemonDetails() {
    if (!pokemonId) {
        detailsContainer.innerHTML = '<p>Nenhum Pokémon selecionado.</p>';
        return;
    }

    try {
        // 1. Pega dados do Pokémon atual
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
        const pokemon = await res.json();

        // 2. Acessa os dados da espécie (onde fica guardada a árvore genealógica)
        const speciesRes = await fetch(pokemon.species.url);
        const speciesData = await speciesRes.json();

        // 3. Pega a cadeia de evolução pura
        const evolutionRes = await fetch(speciesData.evolution_chain.url);
        const evolutionData = await evolutionRes.json();
        
        // Transforma a árvore complexa da API em uma lista plana de nomes das evoluções
        const evolutionNames = parseEvolutions(evolutionData.chain);
        
        // 4. Faz requisições simultâneas para pegar a imagem de cada integrante da evolução
        const evolutionSpecs = await Promise.all(evolutionNames.map(async (name) => {
            try {
                const pRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
                const pData = await pRes.json();
                return {
                    name: name,
                    id: pData.id,
                    img: pData.sprites.front_default || pData.sprites.other['official-artwork'].front_default
                };
            } catch (e) {
                // Caso alguma evolução específica dê erro ou seja de outra geração não indexada diretamente
                return { name: name, id: null, img: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png' };
            }
        }));

        renderDetails(pokemon, evolutionSpecs);

    } catch (error) {
        // Fallback especial: Formas Mega/Alternativas não possuem cadeia evolutiva própria na API
        fetchAlternativeFormDetails();
    }
}

// Fallback para renderizar Megas e formas variantes diretamente (pois não possuem "species.evolution_chain")
async function fetchAlternativeFormDetails() {
    try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
        const pokemon = await res.json();
        renderDetails(pokemon, []); // Renderiza sem seção de evolução ou estática
    } catch(e) {
        detailsContainer.innerHTML = '<p>Erro fatal ao carregar dados do Pokémon.</p>';
    }
}

function parseEvolutions(chain) {
    let evoChain = [];
    let current = chain;

    while (current) {
        evoChain.push(current.species.name);
        // Avança na árvore estrutural (captura caminhos diretos)
        current = current.evolves_to[0];
    }
    return evoChain;
}

function renderDetails(pokemon, evolutions) {
    const { name, id, height, weight, sprites, types, moves } = pokemon;
    const imageUrl = sprites.other['official-artwork'].front_default || sprites.front_default;

    const typesHTML = types.map(t => {
        const color = typeColors[t.type.name] || '#777';
        return `<span class="type-badge" style="background-color: ${color}">${t.type.name}</span>`;
    }).join('');

    const limitedMoves = moves.slice(0, 6).map(m => `<li>${m.move.name.replace(/-/g, ' ')}</li>`).join('');

    // Monta o HTML visual dos mini-cards da cadeia evolutiva com imagem e link redirecionável
    let evolutionsHTML = '';
    if(evolutions.length > 0) {
        evolutionsHTML = evolutions.map((evo, index) => {
            const isCurrent = evo.id === id ? 'style="border-color: #ff3e3e; background: #29292e;"' : '';
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
        evolutionsHTML = '<p style="color:#7c7c8a; font-size:0.9rem;">Formas Especiais/Megas não possuem transformações lineares na base de dados.</p>';
    }

    detailsContainer.innerHTML = `
        <span class="pokemon-id">Nº ${id}</span>
        <h2 class="pokemon-name" style="font-size: 2.2rem; margin-bottom:5px; text-transform: capitalize;">${name.replace(/-/g, ' ')}</h2>
        
        <div class="types-container" style="margin-bottom: 20px;">${typesHTML}</div>
        
        <img class="detail-img" src="${imageUrl}" alt="${name}">
        
        <div class="info-section">
            <h3>Características Corporais</h3>
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