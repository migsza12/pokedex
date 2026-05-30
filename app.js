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

let basePokemonList = []; // Contém {name, url} de todas as formas (~1500 itens)

// Carrega o índice leve de TODOS os pokémons existentes na API
async function initPokedex() {
    try {
        pokedexGrid.innerHTML = '<p class="loading">Sincronizando Banco de Dados da PokéAPI...</p>';
        
        // Faz a busca em duas frentes: Pokémons normais e formas extras/megas combinadas
        const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1500');
        const data = await response.json();
        
        // Mapeia adicionando o ID extraído da própria URL para evitar requisições extras antes da hora
        basePokemonList = data.results.map(pokemon => {
            const urlParts = pokemon.url.split('/');
            const id = urlParts[urlParts.length - 2];
            return { name: pokemon.name, id: parseInt(id), url: pokemon.url };
        });

        // Exibe inicialmente as primeiras 50 formas para a tela não travar, o usuário filtra o resto
        renderList(basePokemonList.slice(0, 60));
    } catch (error) {
        pokedexGrid.innerHTML = '<p class="loading">Falha ao conectar com o servidor.</p>';
    }
}

// Renderiza a estrutura do card imediatamente e busca os detalhes complementares em tempo real
function renderList(list) {
    pokedexGrid.innerHTML = '';
    if (list.length === 0) {
        pokedexGrid.innerHTML = '<p class="loading">Nenhuma variante ou espécie encontrada.</p>';
        return;
    }

    list.forEach(pokemon => {
        // Criamos o card esqueleto estruturado
        const card = document.createElement('a');
        card.href = `detalhes.html?id=${pokemon.id}`;
        card.className = 'pokemon-card';
        card.id = `pkmn-${pokemon.id}`;
        card.innerHTML = `
            <span class="pokemon-id">Nº ${pokemon.id}</span>
            <h2 class="pokemon-name">${pokemon.name.replace(/-/g, ' ')}</h2>
            <div class="img-placeholder" style="height:110px; display:flex; align-items:center; justify-content:center; color:#555;">...</div>
        `;
        pokedexGrid.appendChild(card);

        // Dispara o carregamento assíncrono individual da imagem e tipos para não travar a renderização
        fetchDetailsForCard(pokemon.id, pokemon.url);
    });
}

// Puxa a imagem e os tipos em background apenas dos cards visíveis na busca
async function fetchDetailsForCard(id, url) {
    try {
        const res = await fetch(url);
        const data = await res.json();
        const cardElement = document.getElementById(`pkmn-${id}`);
        if (!cardElement) return;

        const imageUrl = data.sprites.other['official-artwork'].front_default || data.sprites.front_default || 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png';
        
        const typesHTML = data.types.map(t => {
            const color = typeColors[t.type.name] || '#777';
            return `<span class="type-badge" style="background-color: ${color}">${t.type.name}</span>`;
        }).join('');

        // Guarda temporariamente os tipos dentro do próprio elemento para ajudar no filtro posterior
        cardElement.setAttribute('data-types', data.types.map(t => t.type.name).join(','));

        cardElement.innerHTML = `
            <span class="pokemon-id">Nº ${id}</span>
            <h2 class="pokemon-name">${data.name.replace(/-/g, ' ')}</h2>
            <img class="pokemon-img" src="${imageUrl}" alt="${data.name}">
            <div class="types-container">${typesHTML}</div>
        `;

        // Se houver um tipo selecionado no filtro e o card carregado não bater com ele, esconde o card
        const selectedType = typeFilter.value;
        if(selectedType && !data.types.some(t => t.type.name === selectedType)) {
            cardElement.style.display = 'none';
        }

    } catch (e) { /* Ignora falhas isoladas */ }
}

// Filtra dinamicamente os nomes na lista global indexada
let debounceTimeout;
function filterPokemons() {
    clearTimeout(debounceTimeout);
    // Aplica um pequeno delay (debounce) para evitar requisições pesadas a cada tecla digitada
    debounceTimeout = setTimeout(() => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        
        const filtered = basePokemonList.filter(pokemon => pokemon.name.includes(searchTerm));
        // Limita a exibição máxima de resultados simultâneos em tela para preservar performance
        renderList(filtered.slice(0, 80));
    }, 300);
}

searchInput.addEventListener('input', filterPokemons);
typeFilter.addEventListener('change', () => {
    // Quando altera o tipo, força a atualização baseada nos cards ativos
    const selectedType = typeFilter.value;
    const cards = document.querySelectorAll('.pokemon-card');
    cards.forEach(card => {
        const cardTypes = card.getAttribute('data-types') || '';
        if(!selectedType || cardTypes.includes(selectedType)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
});

initPokedex();