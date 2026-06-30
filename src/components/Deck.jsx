import React, { useState, useEffect } from 'react';
import Card from './Card';

export default function Deck({ 
  channels, 
  currentIndex, 
  onSwipeAction, 
  onUndo, 
  canUndo,
  fetchActivity,
  activities
}) {
  const [swipeTrigger, setSwipeTrigger] = useState(null);

  // Reseta o gatilho de swipe quando o card muda
  useEffect(() => {
    setSwipeTrigger(null);
  }, [currentIndex]);

  const handleButtonSwipe = (direction) => {
    if (swipeTrigger) return; // Evita cliques múltiplos
    setSwipeTrigger(direction);
  };

  const handleSwipe = (direction) => {
    setSwipeTrigger(null); // Reseta imediatamente para evitar que o próximo card herde o gatilho
    onSwipeAction(direction);
  };

  if (!channels || channels.length === 0 || currentIndex >= channels.length) {
    return null; // O App deve gerenciar a exibição do Summary neste caso
  }

  const activeChannel = channels[currentIndex];
  const nextChannel = currentIndex + 1 < channels.length ? channels[currentIndex + 1] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div className="deck-container">
        {/* Renderiza o Card de Fundo (Próximo) para efeito visual de pilha */}
        {nextChannel && (
          <div 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              transform: 'scale(0.95) translate3d(0, 15px, 0)',
              opacity: 0.6,
              zIndex: 0,
              pointerEvents: 'none'
            }}
          >
            <Card 
              channel={nextChannel}
              isActive={false}
              activityData={activities[nextChannel.channelId]}
            />
          </div>
        )}

        {/* Renderiza o Card Ativo (Topo) */}
        {activeChannel && (
          <Card 
            key={activeChannel.channelId}
            channel={activeChannel}
            isActive={true}
            onSwipe={handleSwipe}
            triggerSwipe={swipeTrigger}
            fetchActivity={fetchActivity}
            activityData={activities[activeChannel.channelId]}
          />
        )}
      </div>

      {/* Botões de Controle */}
      <div className="deck-controls">
        {/* Botão de Desfazer */}
        <button 
          className="control-btn btn-undo"
          onClick={onUndo}
          disabled={!canUndo}
          title="Desfazer última ação"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </svg>
        </button>

        {/* Botão de Remover (Esquerda) */}
        <button 
          className="control-btn btn-unsub"
          onClick={() => handleButtonSwipe('left')}
          title="Remover inscrição (Deslizar para Esquerda)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Botão de Ativar Sino/Favoritar (Cima) */}
        <button 
          className="control-btn btn-notify"
          onClick={() => handleButtonSwipe('up')}
          title="Ativar Notificações / Favoritar (Deslizar para Cima)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>

        {/* Botão de Manter (Direita) */}
        <button 
          className="control-btn btn-keep"
          onClick={() => handleButtonSwipe('right')}
          title="Manter inscrição (Deslizar para Direita)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
