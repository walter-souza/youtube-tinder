import React from 'react';

export default function QueueStatus({ 
  pendingQueue, 
  quotaExceeded, 
  onUndoLastAction,
  activeClientId,
  clientIdsCount
}) {
  if (quotaExceeded) {
    return (
      <div className="queue-quota-warning">
        <strong>⚠️ Limite de API Excedido (Quota Limit):</strong>
        <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem' }}>
          O Client ID atual atingiu o limite de quota diária permitido pelo YouTube (10.000 unidades). 
        </p>
        <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem' }}>
          {clientIdsCount > 1 ? (
            <span>
              💡 Como você possui múltiplos Client IDs cadastrados, o app está tentando rotacionar para o próximo. Caso todos estejam esgotados, você poderá concluir o processo manualmente no final.
            </span>
          ) : (
            <span>
              💡 <strong>O que fazer?</strong> Você pode abrir as configurações (⚙️) para adicionar outro Client ID ou continuar deslizando e, ao final, usar o <strong>Modo Manual Rápido</strong> para remover os canais com links de 1 clique.
            </span>
          )}
        </p>
      </div>
    );
  }

  if (!pendingQueue || pendingQueue.length === 0) return null;

  // Mostra o item mais recente da fila que está aguardando (em contagem regressiva)
  const waitingItem = [...pendingQueue].reverse().find(item => item.status === 'pending');
  
  if (!waitingItem) return null;

  return (
    <div className="queue-status-bar">
      <div className="queue-info">
        <div className="queue-pulse"></div>
        <div>
          Removendo <strong>{waitingItem.title}</strong>
          <span style={{ color: 'var(--text-muted)', marginLeft: '8px', fontSize: '0.8rem' }}>
            (Executa em {waitingItem.countdown}s...)
          </span>
        </div>
      </div>
      <button 
        type="button" 
        className="queue-btn-undo"
        onClick={() => onUndoLastAction(waitingItem.channelId)}
      >
        Desfazer ↩️
      </button>
    </div>
  );
}
