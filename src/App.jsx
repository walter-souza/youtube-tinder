import React, { useState, useEffect, useRef, useCallback } from 'react';
import StatsHeader from './components/StatsHeader';
import Deck from './components/Deck';
import QueueStatus from './components/QueueStatus';
import Summary from './components/Summary';
import { 
  fetchUserProfile, 
  fetchSubscriptions, 
  fetchChannelsDetails, 
  fetchLatestVideos, 
  unsubscribeChannel 
} from './utils/youtubeApi';

export default function App() {
  // Configurações de Client IDs (salvos no localStorage e suportando ID padrão do ambiente)
  const [clientIds, setClientIds] = useState(() => {
    const saved = localStorage.getItem('yt_tinder_client_ids');
    const list = saved ? JSON.parse(saved) : [];
    
    // Insere o Client ID padrão do ambiente se estiver configurado e não estiver na lista
    const envId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    if (envId && !list.includes(envId)) {
      list.push(envId);
    }
    return list;
  });
  
  const [activeClientId, setActiveClientId] = useState(() => {
    const savedActive = localStorage.getItem('yt_tinder_active_client_id');
    if (savedActive) return savedActive;
    return import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  });

  // Estados de Autenticação e Usuário
  const [accessToken, setAccessToken] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  // Estados de Fluxo e Telas
  // Screens: 'config' | 'auth' | 'loading' | 'deck' | 'summary'
  const [currentScreen, setCurrentScreen] = useState('auth');
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0, statusText: '' });

  // Estados dos Canais e Tinder Cards
  const [channels, setChannels] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stats, setStats] = useState({ kept: 0, unsubscribed: 0, notified: 0 });
  const [history, setHistory] = useState([]); // Histórico de snapshots para o Undo
  const [activities, setActivities] = useState({}); // Mapa de channelId -> { loading, lastVideoDate }
  const [importedOffline, setImportedOffline] = useState(false);
  const fetchingChannels = useRef(new Set());

  // Fila de Execução em Segundo Plano
  const [pendingQueue, setPendingQueue] = useState([]);
  const [manualUnsubscribeList, setManualUnsubscribeList] = useState([]);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Sincroniza Client IDs com localStorage
  useEffect(() => {
    localStorage.setItem('yt_tinder_client_ids', JSON.stringify(clientIds));
  }, [clientIds]);

  useEffect(() => {
    localStorage.setItem('yt_tinder_active_client_id', activeClientId);
  }, [activeClientId]);

  // Define a tela inicial baseada na existência de Client IDs
  useEffect(() => {
    const envId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    if (envId && !activeClientId) {
      setActiveClientId(envId);
    }
    setCurrentScreen('auth');
  }, [clientIds, activeClientId]);

  // Worker de Fila em Background (Executa a cada segundo)
  useEffect(() => {
    if (!isLoggedIn || pendingQueue.length === 0 || quotaExceeded) return;

    const interval = setInterval(async () => {
      // Cria uma cópia da fila para alteração
      let queueChanged = false;
      const updatedQueue = await Promise.all(pendingQueue.map(async (task) => {
        // Se a tarefa está pendente e o tempo ainda não esgotou
        if (task.status === 'pending') {
          if (task.countdown > 1) {
            queueChanged = true;
            return { ...task, countdown: task.countdown - 1 };
          } else {
            // Tempo esgotou! Dispara a exclusão
            queueChanged = true;
            try {
              // Transiciona para processando
              task.status = 'processing';
              
              // Executa API
              await unsubscribeChannel(accessToken, task.subscriptionId);
              
              // Sucesso
              return { ...task, status: 'completed', countdown: 0 };
            } catch (err) {
              console.error(`Erro ao desinscrever de ${task.title}:`, err);
              
              // Tratamento específico de estouro de quota
              if (err.status === 403 || err.reason === 'quotaExceeded') {
                setQuotaExceeded(true);
                
                // Transiciona para falha por quota e adiciona à lista manual
                setManualUnsubscribeList(prev => [
                  ...prev, 
                  { channelId: task.channelId, title: task.title, url: task.url }
                ]);
                
                // Rotaciona automaticamente para o próximo Client ID disponível se houver
                rotateClientIdOnQuotaExceed();

                return { ...task, status: 'failed', countdown: 0 };
              }
              
              // Outros erros (ex: canal já deletado)
              return { ...task, status: 'completed', countdown: 0 }; // Tratamos como concluído para avançar a fila
            }
          }
        }
        return task;
      }));

      // Remove os itens já concluídos/falhados da fila ativa para não acumular memória
      const activeQueue = updatedQueue.filter(task => task.status === 'pending' || task.status === 'processing');
      
      if (queueChanged || activeQueue.length !== pendingQueue.length) {
        setPendingQueue(activeQueue);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingQueue, accessToken, isLoggedIn, quotaExceeded]);

  // Rotaciona Client ID quando estoura a quota
  const rotateClientIdOnQuotaExceed = () => {
    if (clientIds.length <= 1) return;
    const currentIndex = clientIds.indexOf(activeClientId);
    const nextIndex = (currentIndex + 1) % clientIds.length;
    const nextClientId = clientIds[nextIndex];
    
    setActiveClientId(nextClientId);
    
    alert(`O limite de quota do Client ID atual foi atingido. O aplicativo foi alternado para o próximo Client ID configurado: ${nextClientId.slice(0, 15)}... Por favor, clique em "Conectar Conta" para reautenticar.`);
    
    // Força deslogar para reautenticar com o novo ID
    handleLogout();
  };

  // Cadastro de Client IDs
  const handleAddClientId = (id) => {
    if (!clientIds.includes(id)) {
      setClientIds(prev => [...prev, id]);
      if (!activeClientId) setActiveClientId(id);
    }
  };

  const handleDeleteClientId = (id) => {
    const filtered = clientIds.filter(item => item !== id);
    setClientIds(filtered);
    if (activeClientId === id) {
      setActiveClientId(filtered.length > 0 ? filtered[0] : '');
    }
  };

  // Login com Google Identity Services
  const handleLogin = () => {
    if (!activeClientId) {
      alert('Por favor, configure um Client ID primeiro.');
      setCurrentScreen('config');
      return;
    }

    if (!window.google) {
      alert('A biblioteca do Google Identity Services não foi carregada. Verifique sua conexão com a internet.');
      return;
    }

    setLoadingProgress({ current: 0, total: 0, statusText: 'Iniciando login no Google...' });
    setCurrentScreen('loading');

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: activeClientId,
        scope: 'https://www.googleapis.com/auth/youtube',
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            console.error('Erro de login:', tokenResponse);
            alert('Falha na autenticação do Google.');
            setCurrentScreen('auth');
            return;
          }

          setAccessToken(tokenResponse.access_token);
          setIsLoggedIn(true);
          setQuotaExceeded(false);

          // Carrega perfil do usuário logado
          try {
            const profile = await fetchUserProfile(tokenResponse.access_token);
            setUserProfile(profile);
          } catch (err) {
            console.error('Erro ao obter perfil:', err);
          }

          // Se já possui canais importados via Takeout, faz o mapeamento das inscrições
          if (importedOffline && channels.length > 0) {
            mapOfflineChannelsToSubscriptions(tokenResponse.access_token);
          } else {
            // Senão, carrega as inscrições ao vivo da API
            loadLiveSubscriptions(tokenResponse.access_token);
          }
        },
      });

      client.requestAccessToken();
    } catch (err) {
      console.error('Erro ao iniciar Token Client:', err);
      alert('Erro ao inicializar o login do Google: ' + err.message);
      setCurrentScreen('auth');
    }
  };

  const handleLogout = () => {
    setAccessToken('');
    setIsLoggedIn(false);
    setUserProfile(null);
    setCurrentScreen('auth');
  };

  // Carrega inscrições ao vivo via API do YouTube
  const loadLiveSubscriptions = async (token) => {
    setLoadingProgress({ current: 0, total: 0, statusText: 'Buscando lista de inscrições...' });
    
    try {
      let allSubs = [];
      let nextPageToken = '';
      let pagesFetched = 0;

      // Busca todas as inscrições paginadas
      do {
        pagesFetched++;
        setLoadingProgress(prev => ({
          ...prev,
          statusText: `Carregando inscrições (página ${pagesFetched})...`
        }));
        
        const data = await fetchSubscriptions(token, nextPageToken);
        if (data.items) {
          allSubs = [...allSubs, ...data.items];
        }
        nextPageToken = data.nextPageToken || '';
      } while (nextPageToken);

      if (allSubs.length === 0) {
        alert('Nenhuma inscrição encontrada na sua conta.');
        setCurrentScreen('auth');
        return;
      }

      setLoadingProgress({ current: 0, total: allSubs.length, statusText: 'Obtendo detalhes dos canais...' });

      // YouTube channels.list aceita no máximo 50 IDs por chamada
      const channelIds = allSubs.map(item => item.snippet.resourceId.channelId);
      let detailedChannelsMap = {};

      for (let i = 0; i < channelIds.length; i += 50) {
        const batch = channelIds.slice(i, i + 50);
        setLoadingProgress(prev => ({
          ...prev,
          current: i,
          statusText: `Obtendo estatísticas dos canais (${i} de ${channelIds.length})...`
        }));
        
        const detailsData = await fetchChannelsDetails(token, batch);
        if (detailsData.items) {
          detailsData.items.forEach(item => {
            detailedChannelsMap[item.id] = item;
          });
        }
      }

      // Une os dados de inscrição com os detalhes do canal
      const compiledChannels = allSubs.map(sub => {
        const channelId = sub.snippet.resourceId.channelId;
        const details = detailedChannelsMap[channelId];
        
        return {
          subscriptionId: sub.id,
          channelId: channelId,
          title: sub.snippet.title,
          url: sub.snippet.customUrl ? `https://youtube.com/@${sub.snippet.customUrl.replace(/^@/, '')}` : `https://youtube.com/channel/${channelId}`,
          snippet: details?.snippet || sub.snippet,
          statistics: details?.statistics || null,
          brandingSettings: details?.brandingSettings || null
        };
      });

      setChannels(compiledChannels);
      setCurrentIndex(0);
      setStats({ kept: 0, unsubscribed: 0, notified: 0 });
      setHistory([]);
      setCurrentScreen('deck');
    } catch (err) {
      console.error('Erro ao carregar inscrições:', err);
      alert('Falha ao obter inscrições do YouTube: ' + err.message);
      setCurrentScreen('auth');
    }
  };

  // Mapeia inscrições importadas via Takeout com a conta ao vivo no YouTube
  const mapOfflineChannelsToSubscriptions = async (token) => {
    setLoadingProgress({ current: 0, total: channels.length, statusText: 'Mapeando CSV do Takeout com sua conta do YouTube...' });
    
    try {
      let liveSubsMap = {};
      let nextPageToken = '';

      // Lista todas as inscrições ativas para conseguir o "subscriptionId"
      do {
        const data = await fetchSubscriptions(token, nextPageToken);
        if (data.items) {
          data.items.forEach(sub => {
            liveSubsMap[sub.snippet.resourceId.channelId] = sub.id;
          });
        }
        nextPageToken = data.nextPageToken || '';
      } while (nextPageToken);

      // Atualiza os canais offline com os IDs de inscrição correspondentes
      const updatedChannels = channels.map(chan => {
        const subId = liveSubsMap[chan.channelId] || null;
        return {
          ...chan,
          subscriptionId: subId
        };
      });

      // Busca dados de canais detalhados em lote
      const channelIds = updatedChannels.map(item => item.channelId);
      let detailedChannelsMap = {};

      for (let i = 0; i < channelIds.length; i += 50) {
        const batch = channelIds.slice(i, i + 50);
        setLoadingProgress(prev => ({
          ...prev,
          current: i,
          statusText: `Carregando estatísticas adicionais do CSV (${i} de ${channelIds.length})...`
        }));
        
        const detailsData = await fetchChannelsDetails(token, batch);
        if (detailsData.items) {
          detailsData.items.forEach(item => {
            detailedChannelsMap[item.id] = item;
          });
        }
      }

      const compiledChannels = updatedChannels.map(chan => {
        const details = detailedChannelsMap[chan.channelId];
        return {
          ...chan,
          snippet: details?.snippet || { title: chan.title, description: '' },
          statistics: details?.statistics || null,
          brandingSettings: details?.brandingSettings || null
        };
      });

      setChannels(compiledChannels);
      setCurrentIndex(0);
      setStats({ kept: 0, unsubscribed: 0, notified: 0 });
      setHistory([]);
      setCurrentScreen('deck');
    } catch (err) {
      console.error('Erro ao mapear canais offline:', err);
      alert('Falha ao mapear canais offline: ' + err.message);
      setCurrentScreen('auth');
    }
  };

  // Carrega atividade (último vídeo) do canal de forma preguiçosa (lazy)
  const handleFetchActivity = useCallback(async (channelId) => {
    const channel = channels.find(c => c.channelId === channelId);
    if (!channel) return;

    // Se já está carregando ou na fila de requisições, ignora
    if (fetchingChannels.current.has(channelId)) return;

    // Bloqueia chamadas redundantes de forma síncrona imediata
    fetchingChannels.current.add(channelId);

    setActivities(prev => ({
      ...prev,
      [channelId]: { loading: true }
    }));

    // Verifica a playlist de uploads do canal
    let uploadsPlaylistId = channel.brandingSettings?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId && channelId.startsWith('UC')) {
      uploadsPlaylistId = 'UU' + channelId.substring(2);
    }

    try {
      const videos = await fetchLatestVideos(accessToken, uploadsPlaylistId);
      setActivities(prev => ({
        ...prev,
        [channelId]: { loading: false, videos }
      }));
    } catch (err) {
      console.error(`Erro ao carregar atividade do canal ${channelId}:`, err);
      setActivities(prev => ({
        ...prev,
        [channelId]: { loading: false, videos: [] }
      }));
    }
  }, [channels, accessToken]);

  // Lógica de Swipe do Card (Esquerda = Remover, Direita = Manter, Cima = Notificar)
  const handleSwipeAction = (direction) => {
    const channel = channels[currentIndex];
    
    // Grava Snapshot para Histórico (Undo)
    const snapshot = {
      currentIndex,
      stats: { ...stats },
      pendingQueue: [...pendingQueue],
      manualUnsubscribeList: [...manualUnsubscribeList]
    };
    setHistory(prev => [...prev, snapshot]);

    // Aplica alterações baseadas na direção
    if (direction === 'right') {
      // MANTER
      setStats(prev => ({ ...prev, kept: prev.kept + 1 }));
      advanceDeck();
    } else if (direction === 'left') {
      // REMOVER
      setStats(prev => ({ ...prev, unsubscribed: prev.unsubscribed + 1 }));
      
      // Se não estiver logado (offline) ou se a inscrição não existir no YouTube (CSV sem mapeamento),
      // ou se a quota já estiver estourada, vai direto para a lista manual
      if (!isLoggedIn || !channel.subscriptionId || quotaExceeded) {
        setManualUnsubscribeList(prev => [
          ...prev,
          { channelId: channel.channelId, title: channel.title || channel.snippet?.title || 'Canal', url: channel.url }
        ]);
      } else {
        // Adiciona na fila de background de API
        const newTask = {
          channelId: channel.channelId,
          subscriptionId: channel.subscriptionId,
          title: channel.title || channel.snippet?.title || 'Canal',
          url: channel.url,
          countdown: 5, // 5 segundos para desfazer
          status: 'pending'
        };
        setPendingQueue(prev => [...prev, newTask]);
      }
      advanceDeck();
    } else if (direction === 'up') {
      // SINO / NOTIFICAÇÕES (Modo Híbrido)
      setStats(prev => ({ ...prev, notified: prev.notified + 1 }));
      
      // Abre a aba com o canal
      const channelUrl = channel.url || `https://youtube.com/channel/${channel.channelId}`;
      window.open(channelUrl, '_blank');

      advanceDeck();
    }
  };

  const advanceDeck = () => {
    if (currentIndex + 1 >= channels.length) {
      setCurrentScreen('summary');
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // Ação de Desfazer (Undo)
  const handleUndo = () => {
    if (history.length === 0) return;
    
    const lastSnapshot = history[history.length - 1];
    
    // Restaura estados
    setCurrentIndex(lastSnapshot.currentIndex);
    setStats(lastSnapshot.stats);
    setPendingQueue(lastSnapshot.pendingQueue);
    setManualUnsubscribeList(lastSnapshot.manualUnsubscribeList);
    
    // Remove do histórico
    setHistory(prev => prev.slice(0, -1));
    
    // Se o canal que retornou ao topo tinha uma desinscrição pendente na fila de background, 
    // a restauração da fila antiga (sem o novo item) já cancela o envio de forma limpa!
  };

  // Cancela uma tarefa de desinscrição específica na fila (quando desfeita pela barra flutuante)
  const handleCancelPendingTask = (channelId) => {
    setPendingQueue(prev => prev.filter(task => task.channelId !== channelId));
    // Reduz estatística de desinscrição e devolve para "mantidos" ou diminui contador
    setStats(prev => ({ ...prev, unsubscribed: Math.max(0, prev.unsubscribed - 1) }));
    handleUndo(); // Volta o deck de cards para o estado anterior
  };

  // Importação de arquivo offline via Takeout
  const handleImportTakeoutCSV = (importedChannels) => {
    setChannels(importedChannels);
    setImportedOffline(true);
    setCurrentIndex(0);
    setStats({ kept: 0, unsubscribed: 0, notified: 0 });
    setHistory([]);
    // Após importar, redireciona o usuário para a tela de autenticação
    // para ele decidir se loga (mapear + excluir via API) ou continua offline
    setCurrentScreen('auth');
  };

  const handleRestart = () => {
    setChannels([]);
    setCurrentIndex(0);
    setStats({ kept: 0, unsubscribed: 0, notified: 0 });
    setHistory([]);
    setPendingQueue([]);
    setManualUnsubscribeList([]);
    setQuotaExceeded(false);
    setImportedOffline(false);
    setCurrentScreen('auth');
  };

  return (
    <div className="container">
      {/* Exibe Cabeçalho apenas nas telas do Tinder Deck e Summary */}
      {(currentScreen === 'deck' || currentScreen === 'summary') && (
        <StatsHeader 
          userProfile={userProfile}
          stats={stats}
          currentIndex={currentIndex}
          totalCount={channels.length}
          onLogout={handleLogout}
          isLoggedIn={isLoggedIn}
        />
      )}

      {/* Roteamento de Telas */}

      {/* TELA 2: Tela de Conexão com YouTube */}
      {currentScreen === 'auth' && (
        <div className="screen">
          <div className="welcome-card">
            <div style={{ fontSize: '3.5rem', marginBottom: '15px' }}>🔥</div>
            <h1>YouTube Subscription Tinder</h1>
            <p>
              Organize suas inscrições de forma rápida e divertida. Deslize para a esquerda para remover canais que você não assiste mais!
            </p>

            {!activeClientId && (
              <div 
                style={{ 
                  background: 'rgba(255, 71, 87, 0.1)', 
                  border: '1px solid var(--color-unsub)', 
                  padding: '15px', 
                  borderRadius: '12px',
                  marginBottom: '20px',
                  fontSize: '0.85rem',
                  color: '#fff',
                  textAlign: 'left'
                }}
              >
                <strong style={{ display: 'block', marginBottom: '4px' }}>⚠️ Google Client ID ausente</strong>
                O login do Google está desativado. Certifique-se de configurar a variável de ambiente <code>VITE_GOOGLE_CLIENT_ID</code> no painel da Vercel e realizar um novo deploy.
              </div>
            )}
            
            {importedOffline && (
              <div 
                style={{ 
                  background: 'rgba(46, 213, 115, 0.1)', 
                  border: '1px solid var(--color-keep)', 
                  padding: '12px', 
                  borderRadius: '12px',
                  marginBottom: '20px',
                  fontSize: '0.9rem'
                }}
              >
                📂 <strong>{channels.length} canais</strong> carregados do Google Takeout.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '30px' }}>
              <button 
                className="btn" 
                onClick={handleLogin}
                disabled={!activeClientId}
                style={!activeClientId ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              >
                Conectar Conta do YouTube ↗
              </button>
              
              {importedOffline && (
                <button className="btn btn-secondary" onClick={() => setCurrentScreen('deck')}>
                  Iniciar no Modo Offline (Manual)
                </button>
              )}

              {/* Removido botão de configurações adicionais */}
            </div>
          </div>
        </div>
      )}

      {/* TELA 3: Carregamento de Inscrições */}
      {currentScreen === 'loading' && (
        <div className="screen">
          <div className="loader-wrapper text-center">
            <div className="spinner"></div>
            <h2>Carregando Inscrições</h2>
            <p>{loadingProgress.statusText}</p>
            {loadingProgress.total > 0 && (
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                ></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TELA 4: Deck do Tinder */}
      {currentScreen === 'deck' && (
        <div className="screen" style={{ padding: '10px 0' }}>
          <Deck 
            channels={channels}
            currentIndex={currentIndex}
            onSwipeAction={handleSwipeAction}
            onUndo={handleUndo}
            canUndo={history.length > 0}
            fetchActivity={handleFetchActivity}
            activities={activities}
          />
          
          <QueueStatus 
            pendingQueue={pendingQueue}
            quotaExceeded={quotaExceeded}
            onUndoLastAction={handleCancelPendingTask}
            activeClientId={activeClientId}
            clientIdsCount={clientIds.length}
          />
        </div>
      )}

      {/* TELA 5: Resumo e Resultados Finais */}
      {currentScreen === 'summary' && (
        <Summary 
          stats={stats}
          manualUnsubscribeList={manualUnsubscribeList}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
}
