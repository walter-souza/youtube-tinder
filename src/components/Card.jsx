import React, { useState, useEffect, useRef } from 'react';

function formatCount(num) {
  if (!num) return '0';
  const val = parseInt(num, 10);
  if (val >= 1000000) {
    return (val / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (val >= 1000) {
    return (val / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return val.toString();
}

function getRelativeTime(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 30) {
    return `${diffDays} ${diffDays === 1 ? 'dia' : 'dias'} atrás`;
  }
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} ${diffMonths === 1 ? 'mês' : 'meses'} atrás`;
  }
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} ${diffYears === 1 ? 'ano' : 'anos'} atrás`;
}

function parseISO8601Duration(duration) {
  if (!duration) return '';
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';
  const hours = parseInt(match[1] || 0, 10);
  const minutes = parseInt(match[2] || 0, 10);
  const seconds = parseInt(match[3] || 0, 10);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function Card({ 
  channel, 
  isActive, 
  onSwipe, 
  fetchActivity, 
  activityData,
  triggerSwipe
}) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [flyOutDirection, setFlyOutDirection] = useState(null);
  
  const cardRef = useRef(null);
  const dragStart = useRef({ x: 0, y: 0 });

  // Escuta gatilhos externos de swipe (ex: cliques de botões)
  useEffect(() => {
    if (triggerSwipe && isActive) {
      setFlyOutDirection(triggerSwipe);
    }
  }, [triggerSwipe, isActive]);

  // Dispara a busca do status de atividade preguiçosamente (lazy loading) com debounce de 350ms
  // Evita fazer requisições para canais ignorados rapidamente no swipe
  useEffect(() => {
    if (isActive && channel && fetchActivity && !activityData) {
      const timer = setTimeout(() => {
        fetchActivity(channel.channelId);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isActive, channel, fetchActivity, activityData]);

  // Se o card está voando para fora, define a animação de saída
  useEffect(() => {
    if (flyOutDirection) {
      const duration = 300; // ms
      const startTime = performance.now();
      const startX = position.x;
      const startY = position.y;
      
      let targetX = startX;
      let targetY = startY;

      if (flyOutDirection === 'left') {
        targetX = -600;
      } else if (flyOutDirection === 'right') {
        targetX = 600;
      } else if (flyOutDirection === 'up') {
        targetY = -800;
      }

      let animId;
      const animate = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing out quadratic
        const ease = 1 - Math.pow(1 - progress, 2);
        
        const currentX = startX + (targetX - startX) * ease;
        const currentY = startY + (targetY - startY) * ease;
        
        setPosition({ x: currentX, y: currentY });

        if (progress < 1) {
          animId = requestAnimationFrame(animate);
        } else {
          onSwipe(flyOutDirection);
        }
      };

      animId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animId);
    }
  }, [flyOutDirection]);

  if (!channel) return null;

  // Pointer Handlers para gestos de swipe
  const handlePointerDown = (e) => {
    if (!isActive || flyOutDirection) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    cardRef.current.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const x = e.clientX - dragStart.current.x;
    const y = e.clientY - dragStart.current.y;
    setPosition({ x, y });
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    cardRef.current.releasePointerCapture(e.pointerId);

    const threshold = 120; // pixels para ativar swipe
    
    // Determina se ultrapassou os limites e qual a direção dominante
    if (position.x < -threshold) {
      setFlyOutDirection('left');
    } else if (position.x > threshold) {
      setFlyOutDirection('right');
    } else if (position.y < -threshold && Math.abs(position.y) > Math.abs(position.x)) {
      setFlyOutDirection('up');
    } else {
      // Retorna para o centro
      setPosition({ x: 0, y: 0 });
    }
  };

  // Calcula opacidades dos badges baseados no arraste
  const limit = 100;
  const swipeLeftOpacity = position.x < 0 ? Math.min(1, Math.abs(position.x) / limit) : 0;
  const swipeRightOpacity = position.x > 0 ? Math.min(1, position.x / limit) : 0;
  const swipeUpOpacity = (position.y < 0 && Math.abs(position.y) > Math.abs(position.x)) 
    ? Math.min(1, Math.abs(position.y) / limit) 
    : 0;

  // Estilo inline do transform
  const rotation = position.x / 18;
  const cardStyle = {
    transform: flyOutDirection 
      ? `translate3d(${position.x}px, ${position.y}px, 0) rotate(${rotation}deg)`
      : isDragging 
        ? `translate3d(${position.x}px, ${position.y}px, 0) rotate(${rotation}deg)`
        : 'translate3d(0,0,0) rotate(0deg)',
    transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    zIndex: isActive ? 5 : 1
  };

  // Cálculo da inatividade para exibir no badge
  let activityBadge = { text: 'Carregando atividade...', class: 'unknown' };
  if (activityData) {
    if (activityData.loading) {
      activityBadge = { text: 'Verificando atividade...', class: 'unknown' };
    } else if (activityData.videos && activityData.videos.length > 0) {
      const lastVideo = activityData.videos[0];
      const date = new Date(lastVideo.publishedAt);
      const now = new Date();
      const diffMonths = (now - date) / (1000 * 60 * 60 * 24 * 30.44);
      const relativeTime = getRelativeTime(lastVideo.publishedAt);
      
      if (diffMonths >= 6) {
        activityBadge = { 
          text: `⚠️ Inativo • Último vídeo há ${relativeTime}`, 
          class: 'inactive' 
        };
      } else {
        activityBadge = { 
          text: `⚡ Ativo • Último vídeo há ${relativeTime}`, 
          class: 'active' 
        };
      }
    } else {
      activityBadge = { text: '⚠️ Sem envios encontrados', class: 'inactive' };
    }
  }

  // Estatísticas e propriedades básicas
  const bannerUrl = channel.brandingSettings?.image?.bannerExternalUrl;
  const avatarUrl = channel.snippet?.thumbnails?.medium?.url || channel.snippet?.thumbnails?.default?.url;
  const title = channel.snippet?.title || channel.title || 'Canal do YouTube';
  const customUrl = channel.snippet?.customUrl || '';
  const subscribers = channel.statistics?.subscriberCount ? formatCount(channel.statistics.subscriberCount) : 'N/A';
  const videoCount = channel.statistics?.videoCount ? formatCount(channel.statistics.videoCount) : 'N/A';
  const description = channel.snippet?.description || 'Sem descrição disponível.';

  return (
    <div 
      ref={cardRef}
      className="tinder-card"
      style={cardStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Badges de Feedback de Swipe */}
      <div className="card-overlay-badge left" style={{ opacity: swipeLeftOpacity }}>
        Remover
      </div>
      <div className="card-overlay-badge right" style={{ opacity: swipeRightOpacity }}>
        Manter
      </div>
      <div className="card-overlay-badge top" style={{ opacity: swipeUpOpacity }}>
        Sino 🔔
      </div>

      {/* Corpo com Informações Roláveis */}
      <div className="card-body" style={{ padding: 0 }}>
        {/* Header com Banner e Avatar (Dentro do scroll) */}
        <div className="card-header-media" style={{ background: !bannerUrl ? 'linear-gradient(135deg, #1e90ff, #fe3c72)' : 'none' }}>
          {bannerUrl && <img src={bannerUrl} alt="Banner do canal" className="card-banner" draggable="false" />}
          <div className="card-avatar-container">
            <img src={avatarUrl || 'https://via.placeholder.com/90'} alt="Avatar do canal" className="card-avatar" draggable="false" />
          </div>
        </div>

        {/* Conteúdo Textual com Padding original */}
        <div className="card-content-inner" style={{ padding: '55px 20px 20px 20px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
          <div className="card-title-group">
            <h3 className="card-title">
              {title}
            </h3>
            {customUrl && <div className="card-handle">@{customUrl.replace(/^@/, '')}</div>}
            
            <a 
              href={customUrl ? `https://youtube.com/@${customUrl.replace(/^@/, '')}` : `https://youtube.com/channel/${channel.channelId}`} 
              target="_blank" 
              rel="noreferrer" 
              className="card-link"
              style={{ display: 'inline-block', marginTop: '6px', fontSize: '0.8rem' }}
              onPointerDown={(e) => e.stopPropagation()} // Evita arrastar o card ao clicar no link
            >
              Abrir Canal no YT ↗
            </a>
          </div>

          <div className="card-stats">
          <div className="stat-item">
            <span className="stat-highlight">{subscribers}</span> inscritos
          </div>
          <div className="stat-item">
            <span className="stat-highlight">{videoCount}</span> vídeos
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '15px' }}>
          <div className={`activity-badge ${activityBadge.class}`} style={{ margin: 0, alignSelf: 'auto' }}>
            {activityBadge.text}
          </div>
        </div>

        <div className="card-description">
          {description}
        </div>

        {/* Listagem dos Últimos 5 Vídeos */}
        <h4 className="card-videos-section-title">Últimos Vídeos</h4>
        <div className="card-videos-list-inline" onPointerDown={(e) => e.stopPropagation()}>
          {activityData?.videos && activityData.videos.length > 0 ? (
            activityData.videos.map(video => (
              <a 
                key={video.id} 
                href={`https://youtube.com/watch?v=${video.id}`} 
                target="_blank" 
                rel="noreferrer" 
                className="video-item"
              >
                <div className="video-thumbnail-wrapper">
                  <img src={video.thumbnail} alt={video.title} className="video-thumbnail" />
                  {video.duration && (
                    <span className="video-duration">{parseISO8601Duration(video.duration)}</span>
                  )}
                </div>
                <div className="video-info">
                  <div className="video-title" title={video.title}>{video.title}</div>
                  <div className="video-meta">
                    {formatCount(video.viewCount)} vis. • {getRelativeTime(video.publishedAt)}
                  </div>
                </div>
              </a>
            ))
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '15px 0' }}>
              {activityData?.loading ? 'Buscando vídeos...' : 'Nenhum vídeo recente encontrado.'}
            </div>
          )}
        </div>

      </div>
    </div>
  </div>
  );
}
