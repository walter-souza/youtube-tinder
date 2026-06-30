import React from 'react';

export default function StatsHeader({ 
  userProfile, 
  stats, 
  currentIndex, 
  totalCount, 
  onLogout, 
  isLoggedIn
}) {
  const progressPercent = totalCount > 0 ? Math.round((currentIndex / totalCount) * 100) : 0;

  return (
    <div className="stats-header-bar">
      <div className="profile-section">
        {isLoggedIn && userProfile ? (
          <>
            <img 
              src={userProfile.avatar || 'https://via.placeholder.com/40'} 
              alt="Avatar do Usuário" 
              className="profile-avatar"
            />
            <div>
              <div className="profile-name">{userProfile.title}</div>
              <button onClick={onLogout} className="logout-link">Desconectar</button>
            </div>
          </>
        ) : (
          <>
            <div 
              style={{
                width: '40px', 
                height: '40px', 
                borderRadius: '50%', 
                background: 'rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justify: 'center',
                border: '2px dashed var(--text-muted)'
              }}
            >
              🌐
            </div>
            <div>
              <div className="profile-name" style={{color: 'var(--text-secondary)'}}>Modo Local/Takeout</div>
              <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>Sem login ativo</span>
            </div>
          </>
        )}
      </div>

      <div style={{display: 'flex', alignItems: 'center', gap: '25px'}}>
        <div className="stats-section">
          <div className="stats-counter">
            <span className="stats-counter-value keep">{stats.kept}</span>
            <span style={{color: 'var(--text-muted)', fontSize: '0.75rem'}}>Mantidos</span>
          </div>
          <div className="stats-counter">
            <span className="stats-counter-value unsub">{stats.unsubscribed}</span>
            <span style={{color: 'var(--text-muted)', fontSize: '0.75rem'}}>Remover</span>
          </div>
          <div className="stats-counter">
            <span className="stats-counter-value notify">{stats.notified}</span>
            <span style={{color: 'var(--text-muted)', fontSize: '0.75rem'}}>Sinos</span>
          </div>
          <div className="stats-counter" style={{borderLeft: '1px solid var(--border-light)', paddingLeft: '20px'}}>
            <span className="stats-counter-value" style={{color: '#fff'}}>
              {currentIndex} <span style={{color: 'var(--text-muted)', fontSize: '0.8rem'}}>de {totalCount}</span>
            </span>
            <span style={{color: 'var(--text-muted)', fontSize: '0.75rem'}}>Progresso</span>
          </div>
        </div>
      </div>
    </div>
  );
}
