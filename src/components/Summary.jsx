import React, { useState } from 'react';

export default function Summary({ 
  stats, 
  manualUnsubscribeList, 
  onRestart 
}) {
  const [clickedChannels, setClickedChannels] = useState({});

  const handleManualClick = (channelId) => {
    setClickedChannels(prev => ({
      ...prev,
      [channelId]: true
    }));
  };

  const hasManualItems = manualUnsubscribeList && manualUnsubscribeList.length > 0;
  
  // Total que foi planejado remover
  const totalToRemove = stats.unsubscribed;
  // Total removido com sucesso pela API
  const successfullyRemoved = totalToRemove - (manualUnsubscribeList ? manualUnsubscribeList.length : 0);

  return (
    <div className="screen">
      <div className="summary-card">
        <div style={{ fontSize: '3.5rem', marginBottom: '15px' }}>🎉</div>
        <h1>Tudo Limpo!</h1>
        <p>Você revisou todas as suas inscrições. Aqui está o resumo das suas ações:</p>

        {/* Quadro de estatísticas */}
        <div className="summary-stats-grid">
          <div className="summary-stat-box">
            <span className="summary-stat-num keep">{stats.kept}</span>
            <span className="summary-stat-label">Mantidos</span>
          </div>
          <div className="summary-stat-box">
            <span className="summary-stat-num unsub">{successfullyRemoved}</span>
            <span className="summary-stat-label">Removidos API</span>
          </div>
          <div className="summary-stat-box">
            <span className="summary-stat-num notify">{stats.notified}</span>
            <span className="summary-stat-label">Sinos Ativos</span>
          </div>
        </div>

        {/* Caso haja desinscrições manuais pendentes (devido ao estouro da quota da API) */}
        {hasManualItems && (
          <div className="summary-manual-section">
            <h3>⚠️ Remoção Manual Necessária ({manualUnsubscribeList.length} canais)</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '5px 0 15px 0' }}>
              Como a quota diária da API do YouTube foi excedida, estes canais não puderam ser desinscritos automaticamente. 
              Clique no botão de cada canal abaixo para abrir a página dele e cancelar a inscrição em 1 clique.
            </p>
            
            <div className="summary-manual-list">
              {manualUnsubscribeList.map((channel) => {
                const isDone = clickedChannels[channel.channelId];
                const channelUrl = channel.url || `https://youtube.com/channel/${channel.channelId}`;
                const title = channel.title || 'Canal do YouTube';

                return (
                  <div key={channel.channelId} className="manual-item">
                    <span className="manual-item-name" title={title}>
                      {isDone ? '<s>' : ''}{title}{isDone ? '</s>' : ''}
                    </span>
                    <a 
                      href={channelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`manual-btn-link ${isDone ? 'done' : ''}`}
                      onClick={() => handleManualClick(channel.channelId)}
                    >
                      {isDone ? '✓ Feito' : 'Desinscrever ↗'}
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px' }}>
          <button 
            type="button" 
            className="btn" 
            onClick={onRestart}
            style={{ width: '200px' }}
          >
            Iniciar Novamente
          </button>
        </div>
      </div>
    </div>
  );
}
