const typeColors = {
    fire: '#F08030', water: '#6890F0', grass: '#78C850', electric: '#F8D030',
    ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0', ground: '#E0C068',
    flying: '#A890F0', psychic: '#F85888', bug: '#A8B820', rock: '#B8A038',
    ghost: '#705898', dragon: '#7038F8', dark: '#705848', steel: '#B8B8D0',
    fairy: '#EE99AC', normal: '#A8A878'
};

// Intervalos de ID oficiais de cada geração/região na PokeAPI
const generationRanges = {
    "1": { min: 1, max: 151 },       // Kanto
    "2": { min: 152, max: 251 },     // Johto
    "3": { min: 252, max: 386 },     // Hoenn
    "4": { min: 387, max: 493 },     // Sinnoh
    "5": { min: 494, max: 649 },     // Unova
    "6": { min: 650, max: 721 },     // Kalos
    "7": { min: 722, max: 809 },     // Alola
    "8": { min: 810, max: 898 },     // Galar (inclui pequenas variações até 905 dependendo da att)
    "9": { min: 899, max: 1025 },    // Paldea
    "extra": { min: 10001, max: 12000 } // Megas, Formas Alola/Galar/Hisui independentes, Gigantamax
};

const pokedexGrid = document.getElementById('pokedex-grid');
const searchInput = document.getElementById('search-input');
const generationFilter = document.getElementById('generation-filter');
const typeFilter = document.getElementById('type-filter');
const sortOrder = document.getElementById('sort-order');
const sentinel = document.getElementById('scroll-sentinel');
const spinner = sentinel.querySelector('.spinner');

let globalPokemonList = []; 
let filteredPokemonList = []; 
let currentIndex = 0; 
const ITEMS_PER_PAGE = 30; 

async function init() {
    showInitialSkeletons();
    try {
        const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1500');
        const data = await response.json();
        
        globalPokemonList = data.results.map(p => {
            const parts = p.url.split('/');
            const id = parseInt(parts[parts.length - 2]);
            return { name: p.name, id, url: p.url };
        });

        // Executa o filtro e ordenação inicial padrão
        applyFiltersAndSorting();
        setupInfiniteScroll();

    } catch (error) {
        pokedexGrid.innerHTML = '<p class="loading">Erro ao conectar com o servidor.</p>';
    }
}

function showInitialSkeletons() {
    pokedexGrid.innerHTML = Array(12).fill('<div class="skeleton-card"></div>').join('');
}

function loadMorePokemons() {
    if (currentIndex >= filteredPokemonList.length) {
        spinner.classList.add('hidden');
        return;
    }

    spinner.classList.remove('hidden');
    const nextBatch = filteredPokemonList.slice(currentIndex, currentIndex + ITEMS_PER_PAGE);
    
    nextBatch.forEach(pokemon => {
        const card = document.createElement('a');
        card.href = `detalhes.html?id=${pokemon.id}`;
        card.className = 'pokemon-card';
        card.id = `pkmn-${pokemon.id}`;
        card.innerHTML = `
            <span class="pokemon-id">Nº ${pokemon.id}</span>
            <h2 class="pokemon-name">${pokemon.name.replace(/-/g, ' ')}</h2>
            <div class="skeleton-card" style="width:90px; height:90px; margin: 8px 0; border-radius:50%"></div>
        `;
        pokedexGrid.appendChild(card);
        fetchCardDetails(pokemon.id, pokemon.url);
    });

    currentIndex += ITEMS_PER_PAGE;
}

async function fetchCardDetails(id, url) {
    try {
        const res = await fetch(url);
        const data = await res.json();
        const cardElement = document.getElementById(`pkmn-${id}`);
        if (!cardElement) return;

        const imageUrl = data.sprites.other['official-artwork'].front_default || 
                         data.sprites.front_default || 
                         'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png';
        
        const typesHTML = data.types.map(t => {
            const color = typeColors[t.type.name] || '#777';
            return `<span class="type-badge" style="background-color: ${color}">${t.type.name}</span>`;
        }).join('');

        cardElement.innerHTML = `
            <span class="pokemon-id">Nº ${id}</span>
            <h2 class="pokemon-name">${data.name.replace(/-/g, ' ')}</h2>
            <img class="pokemon-img" src="${imageUrl}" alt="${data.name}" loading="lazy">
            <div class="types-container">${typesHTML}</div>
        `;

    } catch (e) {}
}

function setupInfiniteScroll() {
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && globalPokemonList.length > 0) {
            loadMorePokemons();
        }
    }, { rootMargin: '200px' });

    observer.observe(sentinel);
}

// CENTRALIZADOR DE FILTROS E ORDENAÇÃO
let filterDebounce;
async function applyFiltersAndSorting() {
    clearTimeout(filterDebounce);
    
    filterDebounce = setTimeout(async () => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const selectedGen = generationFilter.value;
        const selectedType = typeFilter.value;
        const selectedOrder = sortOrder.value;

        pokedexGrid.innerHTML = '';
        currentIndex = 0;
        spinner.classList.remove('hidden');

        // 1. APLICAR FILTRO DE BUSCA TEXTUAL E GERAÇÃO (Trabalha localmente em memória)
        let results = globalPokemonList.filter(pokemon => {
            // Valida termo de busca
            const matchesSearch = pokemon.name.includes(searchTerm) || pokemon.id.toString() === searchTerm;
            
            // Valida intervalo de geração
            let matchesGen = true;
            if (selectedGen !== 'all') {
                const range = generationRanges[selectedGen];
                // Caso seja a geração 8, ajustamos uma margem de segurança para formas de Galar estendidas
                if(selectedGen === '8') {
                    matchesGen = pokemon.id >= range.min && pokemon.id <= 905;
                } else {
                    matchesGen = pokemon.id >= range.min && pokemon.id <= range.max;
                }
            }
            
            return matchesSearch && matchesGen;
        });

        // 2. APLICAR FILTRO DE TIPO (Caso requisitado)
        if (selectedType) {
            pokedexGrid.innerHTML = '<p class="loading">Cruzando tipos e gerações...</p>';
            try {
                const typeRes = await fetch(`https://pokeapi.co/api/v2/type/${selectedType}`);
                const typeData = await typeRes.json();
                const pokemonsOfType = typeData.pokemon.map(p => p.pokemon.name);
                
                results = results.filter(p => pokemonsOfType.includes(p.name));
            } catch (err) { console.error(err); }
        }

        // 3. APLICAR ORDENAÇÃO DINÂMICA
        if (selectedOrder === 'id-asc') {
            results.sort((a, b) => a.id - b.id);
        } else if (selectedOrder === 'id-desc') {
            results.sort((a, b) => b.id - a.id);
        } else if (selectedOrder === 'name-asc') {
            results.sort((a, b) => a.name.localeCompare(b.name));
        }

        filteredPokemonList = results;
        pokedexGrid.innerHTML = '';
        
        if (filteredPokemonList.length === 0) {
            pokedexGrid.innerHTML = '<p class="loading">Nenhum Pokémon encontrado com essa combinação de filtros.</p>';
            spinner.classList.add('hidden');
        } else {
            loadMorePokemons();
        }
    }, 300);
}

// Escutadores de eventos para qualquer mudança nos controles
searchInput.addEventListener('input', applyFiltersAndSorting);
generationFilter.addEventListener('change', applyFiltersAndSorting);
typeFilter.addEventListener('change', applyFiltersAndSorting);
sortOrder.addEventListener('change', applyFiltersAndSorting);

init();