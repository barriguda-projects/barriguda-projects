/**
 * ============================================
 * BARRIGUDA WEB TV - FEED DO YOUTUBE
 * ============================================
 * Script para carregar e exibir vídeos mais recentes
 * do canal "barrigudawebtv" no YouTube.
 * 
 * Estratégias de busca (em ordem de prioridade):
 * 1. YouTube Data API v3 (requer API Key)
 * 2. YouTube RSS Feed (sem API Key - fallback)
 * 3. Dados de demonstração (último recurso)
 * 
 * Padrões: Adapter, Strategy, Observer
 * ============================================
 */

/**
 * Classe para buscar e renderizar feed do YouTube
 * @implements {Adapter Pattern}
 */
class YouTubeFeedService {
    constructor(options = {}) {
        this.channelId = options.channelId || null;
        this.channelHandle = options.channelHandle || 'barrigudawebtv';
        this.apiKey = options.apiKey || null;
        this.maxResults = options.maxResults || 6;

        // Cache em memória
        this.cache = {
            data: null,
            timestamp: 0,
            ttl: 5 * 60 * 1000 // 5 minutos
        };

        // Elementos DOM
        this.container = document.getElementById('youtube-feed');
        this.allVideosContainer = document.getElementById('all-videos-grid');

        // Tentar descobrir o channelId pelo handle
        this.discoverChannelId();
    }

    /**
     * Tenta descobrir o ID do canal pelo nome de usuário/handle
     */
    async discoverChannelId() {
        // Se já temos o channelId, não precisamos descobrir
        if (this.channelId) return;

        try {
            // Tentar via RSS - o feed do canal pode nos dar o ID
            const rssUrl = `https://www.youtube.com/feeds/videos.xml?user=${this.channelHandle}`;
            // Nota: RSS não funciona diretamente no browser devido a CORS
            // Usaremos uma abordagem alternativa

            // Fallback: tentar via oEmbed
            const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/@${this.channelHandle}&format=json`;

            // Tentar buscar via proxy ou API alternativa
            // Por enquanto, usaremos o método RSS via proxy público
            this.channelId = await this.fetchChannelIdViaProxy();
        } catch (error) {
            console.warn('Não foi possível descobrir o ID do canal:', error);
        }
    }

    /**
     * Tenta obter o channelId via serviço proxy
     */
    async fetchChannelIdViaProxy() {
        // Usar um serviço que converte handle para channel ID
        // Alternativa: usar a página do canal e extrair o ID
        try {
            // Método 1: Tentar via noembed (serviço de oEmbed)
            const response = await fetch(
                `https://noembed.com/embed?url=https://www.youtube.com/@${this.channelHandle}`
            );
            if (response.ok) {
                const data = await response.json();
                // Extrair channelId do author_url ou outro campo
                if (data.author_url) {
                    const match = data.author_url.match(/channel\/([^/]+)/);
                    if (match) return match[1];
                }
            }
        } catch (e) {
            // Silenciar erro - fallback será usado
        }
        return null;
    }

    /**
     * Busca vídeos mais recentes do canal
     * @returns {Promise<Array>} Array de objetos de vídeo
     */
    async fetchVideos() {
        // Verificar cache
        if (this.cache.data && (Date.now() - this.cache.timestamp) < this.cache.ttl) {
            return this.cache.data;
        }

        let videos = [];

        // Estratégia 1: YouTube Data API
        if (this.apiKey && this.channelId) {
            try {
                videos = await this.fetchViaAPI();
            } catch (error) {
                console.warn('Falha na API do YouTube, tentando RSS...', error);
            }
        }

        // Estratégia 2: RSS Feed (sem API key)
        if (videos.length === 0) {
            try {
                videos = await this.fetchViaRSS();
            } catch (error) {
                console.warn('Falha no RSS, usando dados de demonstração...', error);
            }
        }

        // Estratégia 3: Dados de demonstração
        if (videos.length === 0) {
            videos = this.getMockVideos();
        }

        // Atualizar cache
        this.cache.data = videos;
        this.cache.timestamp = Date.now();

        return videos;
    }

    /**
     * Busca via YouTube Data API v3
     */
    async fetchViaAPI() {
        const url = new URL('https://www.googleapis.com/youtube/v3/search');
        url.searchParams.set('key', this.apiKey);
        url.searchParams.set('channelId', this.channelId);
        url.searchParams.set('part', 'snippet,id');
        url.searchParams.set('order', 'date');
        url.searchParams.set('maxResults', this.maxResults.toString());
        url.searchParams.set('type', 'video');

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        return data.items.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: this.getBestThumbnail(item.snippet.thumbnails),
            publishedAt: new Date(item.snippet.publishedAt),
            channelTitle: item.snippet.channelTitle,
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`
        }));
    }

    /**
     * Busca via RSS Feed do YouTube
     * Não requer API Key!
     */
    async fetchViaRSS() {
        // Usar um serviço CORS proxy para acessar o RSS
        const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${this.channelId || 'default'}`;

        // Tentar via rss2json (serviço que converte RSS para JSON)
        const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('RSS indisponível');

            const data = await response.json();

            if (data.status !== 'ok' || !data.items) {
                throw new Error('RSS vazio ou inválido');
            }

            return data.items.slice(0, this.maxResults).map(item => {
                // Extrair videoId da URL
                const videoId = item.guid?.split(':').pop() || 
                               item.link?.split('v=')[1]?.split('&')[0] ||
                               item.link?.split('/').pop();

                return {
                    id: videoId,
                    title: item.title,
                    description: item.description?.substring(0, 200) + '...' || '',
                    thumbnail: item.thumbnail || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                    publishedAt: new Date(item.pubDate),
                    channelTitle: item.author || 'Barriguda Web TV',
                    url: item.link
                };
            });
        } catch (error) {
            // Se falhar com channel_id, tentar com user
            const userRssUrl = `https://www.youtube.com/feeds/videos.xml?user=${this.channelHandle}`;
            const userProxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(userRssUrl)}`;

            const response = await fetch(userProxyUrl);
            const data = await response.json();

            if (data.status !== 'ok' || !data.items) {
                throw new Error('RSS do usuário também falhou');
            }

            return data.items.slice(0, this.maxResults).map(item => {
                const videoId = item.guid?.split(':').pop() || 
                               item.link?.split('v=')[1]?.split('&')[0];

                return {
                    id: videoId,
                    title: item.title,
                    description: item.description?.substring(0, 200) + '...' || '',
                    thumbnail: item.thumbnail || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                    publishedAt: new Date(item.pubDate),
                    channelTitle: item.author || 'Barriguda Web TV',
                    url: item.link
                };
            });
        }
    }

    /**
     * Obtém a melhor thumbnail disponível
     */
    getBestThumbnail(thumbnails) {
        if (thumbnails.maxres) return thumbnails.maxres.url;
        if (thumbnails.standard) return thumbnails.standard.url;
        if (thumbnails.high) return thumbnails.high.url;
        if (thumbnails.medium) return thumbnails.medium.url;
        return thumbnails.default?.url;
    }

    /**
     * Dados de demonstração (fallback final)
     */
    getMockVideos() {
        return [
            {
                id: 'mock1',
                title: '📺 Jornal da Barriguda - Edição Especial',
                description: 'As principais notícias da região em uma edição especial.',
                thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
                publishedAt: new Date(Date.now() - 86400000),
                channelTitle: 'Barriguda Web TV',
                url: 'https://www.youtube.com/@barrigudawebtv'
            },
            {
                id: 'mock2',
                title: '🎥 Cobertura do Evento Cultural 2026',
                description: 'Tudo o que aconteceu no maior evento cultural da região.',
                thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
                publishedAt: new Date(Date.now() - 172800000),
                channelTitle: 'Barriguda Web TV',
                url: 'https://www.youtube.com/@barrigudawebtv'
            },
            {
                id: 'mock3',
                title: '🌳 Especial Meio Ambiente - Preservação',
                description: 'Conheça as iniciativas de preservação ambiental da nossa região.',
                thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
                publishedAt: new Date(Date.now() - 259200000),
                channelTitle: 'Barriguda Web TV',
                url: 'https://www.youtube.com/@barrigudawebtv'
            },
            {
                id: 'mock4',
                title: '🎤 Entrevista com o Prefeito',
                description: 'Conversa exclusiva sobre os projetos para a cidade.',
                thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
                publishedAt: new Date(Date.now() - 345600000),
                channelTitle: 'Barriguda Web TV',
                url: 'https://www.youtube.com/@barrigudawebtv'
            },
            {
                id: 'mock5',
                title: '🏆 Campeonato Regional de Futebol',
                description: 'Melhores momentos da final do campeonato.',
                thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
                publishedAt: new Date(Date.now() - 432000000),
                channelTitle: 'Barriguda Web TV',
                url: 'https://www.youtube.com/@barrigudawebtv'
            },
            {
                id: 'mock6',
                title: '🎉 Festa de São João - Cobertura Completa',
                description: 'Toda a animação da festa junina em nossa cidade.',
                thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
                publishedAt: new Date(Date.now() - 518400000),
                channelTitle: 'Barriguda Web TV',
                url: 'https://www.youtube.com/@barrigudawebtv'
            }
        ];
    }

    /**
     * Formata a data relativa (ex: "há 2 dias")
     */
    formatRelativeDate(date) {
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const weeks = Math.floor(days / 7);
        const months = Math.floor(days / 30);
        const years = Math.floor(days / 365);

        if (seconds < 60) return 'agora mesmo';
        if (minutes < 60) return `há ${minutes} minuto${minutes > 1 ? 's' : ''}`;
        if (hours < 24) return `há ${hours} hora${hours > 1 ? 's' : ''}`;
        if (days < 7) return `há ${days} dia${days > 1 ? 's' : ''}`;
        if (weeks < 4) return `há ${weeks} semana${weeks > 1 ? 's' : ''}`;
        if (months < 12) return `há ${months} mês${months > 1 ? 'es' : ''}`;
        return `há ${years} ano${years > 1 ? 's' : ''}`;
    }

    /**
     * Renderiza um card de vídeo
     */
    createVideoCard(video) {
        const card = document.createElement('article');
        card.className = 'youtube-card';
        card.setAttribute('role', 'article');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `Vídeo: ${video.title}`);

        const relativeDate = this.formatRelativeDate(video.publishedAt);

        card.innerHTML = `
            <a href="${video.url}" target="_blank" rel="noopener noreferrer" class="youtube-thumbnail-link" aria-label="Assistir: ${video.title}">
                <div class="youtube-thumbnail">
                    <img src="${video.thumbnail}" alt="Thumbnail: ${video.title}" loading="lazy" onerror="this.src='https://img.youtube.com/vi/${video.id}/mqdefault.jpg'">
                    <div class="youtube-play" aria-hidden="true">
                        <i class="fas fa-play"></i>
                    </div>
                </div>
            </a>
            <div class="youtube-info">
                <h3 class="youtube-title">${video.title}</h3>
                <div class="youtube-meta">
                    <span><i class="fas fa-user"></i> ${video.channelTitle}</span>
                    <span><i class="fas fa-clock"></i> ${relativeDate}</span>
                </div>
            </div>
        `;

        // Navegação por teclado (IHC)
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                window.open(video.url, '_blank');
            }
        });

        return card;
    }

    /**
     * Renderiza os vídeos no container
     */
    render(videos) {
        if (!this.container) return;

        this.container.innerHTML = '';

        if (videos.length === 0) {
            this.container.innerHTML = `
                <div class="loading-spinner" style="grid-column: 1 / -1;">
                    <p>Nenhum vídeo encontrado no momento.</p>
                    <a href="https://www.youtube.com/@${this.channelHandle}" target="_blank" class="btn btn-primary" style="margin-top: 16px;">
                        <i class="fab fa-youtube"></i> Visitar Canal
                    </a>
                </div>
            `;
            return;
        }

        videos.forEach(video => {
            this.container.appendChild(this.createVideoCard(video));
        });
    }

    /**
     * Renderiza estado de erro
     */
    renderError(message) {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="loading-spinner" style="grid-column: 1 / -1;">
                <p style="color: #dc3545;"><i class="fas fa-exclamation-circle"></i> ${message}</p>
                <button onclick="youtubeFeed.refresh()" class="btn btn-primary" style="margin-top: 16px;">
                    <i class="fas fa-sync"></i> Tentar Novamente
                </button>
            </div>
        `;
    }

    /**
     * Carrega e renderiza os vídeos
     */
    async load() {
        if (!this.container) return;

        try {
            const videos = await this.fetchVideos();
            this.render(videos);
        } catch (error) {
            console.error('Erro ao carregar vídeos:', error);
            this.renderError('Erro ao carregar vídeos. Tente novamente mais tarde.');
        }
    }

    /**
     * Força atualização do feed (ignora cache)
     */
    async refresh() {
        this.cache.data = null;
        this.cache.timestamp = 0;

        // Mostrar loading
        if (this.container) {
            this.container.innerHTML = `
                <div class="loading-spinner" style="grid-column: 1 / -1;">
                    <div class="spinner"></div>
                    <p>Atualizando vídeos...</p>
                </div>
            `;
        }

        await this.load();
    }
}

/**
 * Inicialização do feed do YouTube
 * 
 * INSTRUÇÕES PARA USAR COM API KEY:
 * 
 * 1. Vá para https://console.cloud.google.com/
 * 2. Crie um projeto e ative a YouTube Data API v3
 * 3. Gere uma API Key
 * 4. Substitua 'SUA_API_KEY_AQUI' abaixo:
 */
const youtubeFeed = new YouTubeFeedService({
    // apiKey: 'SUA_API_KEY_AQUI',      // Descomente e insira sua API Key
    channelId: 'UC6YMH2FVrVRN1KNO9-aH-SA',     // Opcional - será descoberto automaticamente
    channelHandle: 'barrigudawebtv',   // Nome do canal no YouTube
    maxResults: 6
});

// Carregar vídeos quando a página iniciar
document.addEventListener('DOMContentLoaded', () => {
    youtubeFeed.load();
});

// Atualizar vídeos quando a seção Home ou Vídeos for exibida
// Isso garante que os vídeos mais recentes sempre apareçam
document.addEventListener('sectionChange', (e) => {
    if (e.detail?.section === 'home' || e.detail?.section === 'videos') {
        youtubeFeed.refresh();
    }
});

// Atualizar a cada 5 minutos (300000ms) quando a aba estiver visível
setInterval(() => {
    if (!document.hidden) {
        youtubeFeed.refresh();
    }
}, 300000);

// Atualizar quando o usuário retornar à página
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        youtubeFeed.refresh();
    }
});
