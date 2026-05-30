const typeColors = {
    fire: '#F08030', water: '#6890F0', grass: '#78C850', electric: '#F8D030',
    ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0', ground: '#E0C068',
    flying: '#A890F0', psychic: '#F85888', bug: '#A8B820', rock: '#B8A038',
    ghost: '#705898', dragon: '#7038F8', dark: '#705848', steel: '#B8B8D0',
    fairy: '#EE99AC', normal: '#A8A878'
};

const pokedexGrid = document.getElementById('pokedex-grid');
const searchInput = document.getElementById('search-input');
const typeFilter = document.getElementById('type-filter');
const sentinel = document.getElementById('scroll-sentinel');
const spinner = sentinel.querySelector('.spinner');

let globalPokemonList = []; // Banco leve com o índice de todos os pokémons
let filteredPokemonList = []; // Lista atual após aplicar filtros de busca ou tipo
let currentIndex = 0; // Controla quantos pokémons já foram impressos na tela
const ITEMS_PER_PAGE = 30; // Quantidade carregada por vez no scroll

// Inicializa a base de dados
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

        filteredPokemonList = [...globalPokemonList];
        pokedexGrid.innerHTML = ''; // Remove os skeletons iniciais
        
        loadMorePokemons();
        setupInfiniteScroll();

    } catch (error) {
        pokedexGrid.innerHTML = '<p class="loading">Erro ao conectar com a base de dados central.</p>';
    }
}

// Cria blocos cinzas pulsantes (Skeletons) no carregamento inicial da página
function showInitialSkeletons() {
    pokedexGrid.innerHTML = Array(12).fill('<div class="skeleton-card"></div>').join('');
}

// Renderiza o próximo lote de Pokémons baseado no scroll atual
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

        // Dispara requisição paralela e assíncrona para coletar a imagem e os tipos reais
        fetchCardDetails(pokemon.id, pokemon.url);
    });

    currentIndex += ITEMS_PER_PAGE;
}

// Busca a imagem de alta qualidade e faz o fallback caso ela não exista
async function fetchCardDetails(id, url) {
    try {
        const res = await fetch(url);
        const data = await res.json();
        const cardElement = document.getElementById(`pkmn-${id}`);
        if (!cardElement) return;

        // Fallbacks sequenciais: Arte oficial -> Sprite clássica -> Pokebola genérica de erro
        const imageUrl = data.sprites.other['official-artwork'].front_default || 
                         data.sprites.front_default || 
                         'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png';
        
        const typesHTML = data.types.map(t => {
            const color = typeColors[t.type.name] || '#777';
            return `<span class="type-badge" style="background-color: ${color}">${t.type.name}</span>`;
        }).join('');

        // Insere os dados reais no esqueleto, substituindo o loading do elemento
        cardElement.innerHTML = `
            <span class="pokemon-id">Nº ${id}</span>
            <h2 class="pokemon-name">${data.name.replace(/-/g, ' ')}</h2>
            <img class="pokemon-img" src="${imageUrl}" alt="${data.name}" loading="lazy">
            <div class="types-container">${typesHTML}</div>
        `;

    } catch (e) { /* Trata falhas mantendo o formato básico estrutural */ }
}

// Configura o observador de scroll nativo (IntersectionObserver)
function setupInfiniteScroll() {
    const observer = new IntersectionObserver((entries) => {
        // Se o elemento sentinela entrar na viewport do usuário, carrega mais itens
        if (entries[0].isIntersecting && globalPokemonList.length > 0) {
            loadMorePokemons();
        }
    }, { rootMargin: '200px' }); // Carrega 200px antes do usuário chegar de fato no fim da tela

    observer.observe(sentinel);
}

// Lógica unificada para gerenciar filtros e busca por digitação simultâneos
let searchDebounce;
async function handleFilters() {
    clearTimeout(searchDebounce);
    
    searchDebounce = setTimeout(async () => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const selectedType = typeFilter.value;

        pokedexGrid.innerHTML = '';
        currentIndex = 0;
        spinner.classList.remove('hidden');

        // 1. Filtro por Nome/ID via memória interna (Instantâneo)
        let results = globalPokemonList.filter(p => p.name.includes(searchTerm) || p.id.toString() === searchTerm);

        // 2. Filtro por tipo (Se selecionado, precisamos verificar individualmente via API)
        if (selectedType) {
            pokedexGrid.innerHTML = '<p class="loading">Filtrando por tipo elemental...</p>';
            try {
                const typeRes = await fetch(`https://pokeapi.co/api/v2/type/${selectedType}`);
                const typeData = await typeRes.json();
                const pokemonsOfType = typeData.pokemon.map(p => p.pokemon.name);
                
                // Cruza os dados da busca textual com os dados vindos do filtro de tipo
                results = results.filter(p => pokemonsOfType.includes(p.name));
            } catch (err) { /* Falha de conexão com filtro */ }
        }

        filteredPokemonList = results;
        pokedexGrid.innerHTML = '';
        loadMorePokemons();
    }, 400); // 400ms de delay para evitar requisições desnecessárias enquanto digita
}

searchInput.addEventListener('input', handleFilters);
typeFilter.addEventListener('change', handleFilters);

init();