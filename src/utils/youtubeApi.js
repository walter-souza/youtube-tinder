/**
 * Utilitários para interagir com a API do YouTube v3
 */

const BASE_URL = 'https://www.googleapis.com/youtube/v3';

/**
 * Faz uma requisição auxiliar com cabeçalhos comuns e tratamento de erro
 */
async function fetchFromYouTube(endpoint, accessToken, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json',
    ...options.headers
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let errorData = {};
    try {
      errorData = await response.json();
    } catch (e) {
      // Ignorar se não for json
    }

    const error = new Error(errorData.error?.message || `Erro na API do YouTube: ${response.status}`);
    error.status = response.status;
    error.reason = errorData.error?.errors?.[0]?.reason || '';
    throw error;
  }

  if (response.status === 204) {
    return null; // Caso de DELETE bem sucedido sem corpo
  }

  return response.json();
}

/**
 * Obtém o perfil do canal do usuário logado
 */
export async function fetchUserProfile(accessToken) {
  const data = await fetchFromYouTube('/channels?part=snippet&mine=true', accessToken);
  if (data.items && data.items.length > 0) {
    const item = data.items[0];
    return {
      title: item.snippet.title,
      avatar: item.snippet.thumbnails.default?.url,
      id: item.id
    };
  }
  return null;
}

/**
 * Obtém a lista de inscrições do usuário logado de forma paginada
 * @param {string} accessToken Token de acesso OAuth2
 * @param {string} pageToken Token da próxima página (opcional)
 */
export async function fetchSubscriptions(accessToken, pageToken = '') {
  const pageTokenParam = pageToken ? `&pageToken=${pageToken}` : '';
  const endpoint = `/subscriptions?part=snippet,contentDetails&mine=true&maxResults=50&order=alphabetical${pageTokenParam}`;
  return fetchFromYouTube(endpoint, accessToken);
}

/**
 * Obtém detalhes de múltiplos canais (como estatísticas de inscritos e banner)
 * @param {string} accessToken Token de acesso OAuth2
 * @param {string[]} channelIds Array de IDs de canais do YouTube (máx 50)
 */
export async function fetchChannelsDetails(accessToken, channelIds) {
  if (!channelIds || channelIds.length === 0) return { items: [] };
  const endpoint = `/channels?part=snippet,statistics,brandingSettings&id=${channelIds.join(',')}`;
  return fetchFromYouTube(endpoint, accessToken);
}

/**
 * Obtém os 3 últimos vídeos enviados pelo canal
 * Inclui duração e visualizações buscando detalhes dos vídeos na API
 * @param {string} accessToken Token de acesso OAuth2
 * @param {string} uploadsPlaylistId ID da playlist de uploads do canal
 */
export async function fetchLatestVideos(accessToken, uploadsPlaylistId) {
  if (!uploadsPlaylistId) return [];
  const playlistEndpoint = `/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=5`;
  
  try {
    const playlistData = await fetchFromYouTube(playlistEndpoint, accessToken);
    if (!playlistData.items || playlistData.items.length === 0) return [];
    
    const videoIds = playlistData.items.map(item => item.snippet.resourceId.videoId);
    
    // Busca estatísticas adicionais dos vídeos (visualizações e duração)
    const videosEndpoint = `/videos?part=contentDetails,statistics&id=${videoIds.join(',')}`;
    const videosData = await fetchFromYouTube(videosEndpoint, accessToken);
    
    const videosMap = {};
    if (videosData.items) {
      videosData.items.forEach(item => {
        videosMap[item.id] = item;
      });
    }

    return playlistData.items.map(item => {
      const videoId = item.snippet.resourceId.videoId;
      const details = videosMap[videoId];
      return {
        id: videoId,
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        duration: details?.contentDetails?.duration || '',
        viewCount: details?.statistics?.viewCount || '0'
      };
    });
  } catch (err) {
    console.error(`Erro ao obter últimos vídeos para a playlist ${uploadsPlaylistId}:`, err);
  }
  return [];
}


/**
 * Remove a inscrição de um canal (Unsubscribe)
 * @param {string} accessToken Token de acesso OAuth2
 * @param {string} subscriptionId ID da inscrição (não o ID do canal)
 */
export async function unsubscribeChannel(accessToken, subscriptionId) {
  const endpoint = `/subscriptions?id=${subscriptionId}`;
  return fetchFromYouTube(endpoint, accessToken, {
    method: 'DELETE'
  });
}
