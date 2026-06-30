import React, { useState } from 'react';

export default function ConfigModal({ 
  clientIds, 
  activeClientId, 
  onAddClientId, 
  onDeleteClientId, 
  onSetActiveClientId, 
  onClose,
  onImportTakeoutCSV
}) {
  const [newId, setNewId] = useState('');
  const [error, setError] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newId.trim()) return;
    
    if (!newId.includes('.apps.googleusercontent.com')) {
      setError('O Client ID deve terminar com ".apps.googleusercontent.com"');
      return;
    }

    onAddClientId(newId.trim());
    setNewId('');
    setError('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      try {
        const lines = text.split(/\r?\n/);
        const importedChannels = [];
        
        // Formato esperado do Google Takeout: "Channel Id","Channel Title","Channel Url"
        // Pulamos a primeira linha (cabeçalho)
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Split considerando aspas
          const fields = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
          if (fields.length >= 3) {
            const id = fields[0].replace(/^["']|["']$/g, '').trim();
            const title = fields[1].replace(/^["']|["']$/g, '').trim();
            const url = fields[2].replace(/^["']|["']$/g, '').trim();
            
            if (id && id.startsWith('UC')) {
              importedChannels.push({
                channelId: id,
                title: title,
                url: url,
                // Ao importar via Takeout, não temos o subscriptionId direto. 
                // Buscaremos isso ou usaremos o modo manual se o usuário não logar.
                subscriptionId: null 
              });
            }
          }
        }

        if (importedChannels.length === 0) {
          alert('Nenhuma inscrição válida encontrada no arquivo CSV. Verifique se é o arquivo "subscriptions.csv" exportado do Google Takeout.');
          return;
        }

        onImportTakeoutCSV(importedChannels);
        alert(`${importedChannels.length} inscrições carregadas com sucesso a partir do CSV do Takeout!`);
        if (onClose) onClose();
      } catch (err) {
        console.error('Erro ao ler CSV:', err);
        alert('Erro ao processar o arquivo. Certifique-se de que é o CSV original do Takeout.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="screen">
      <div className="welcome-card">
        <h1>Configuração do YouTube Tinder</h1>
        <p>Para usar o aplicativo, você precisa configurar pelo menos um <strong>Google Client ID</strong> para o fluxo de autenticação oficial do YouTube.</p>

        <div className="setup-instructions">
          <h3>Como obter seu Google Client ID:</h3>
          <ol>
            <li>Acesse o <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" style={{color: 'var(--color-notify)'}}>Google Cloud Console</a>.</li>
            <li>Crie um projeto e ative a **YouTube Data API v3**.</li>
            <li>Em **Tela de consentimento OAuth**, configure como *Externo*, preencha os dados e adicione seu próprio e-mail como *Usuário de Teste* (obrigatório).</li>
            <li>Adicione os escopos: <code>.../auth/youtube.readonly</code> e <code>.../auth/youtube</code>.</li>
            <li>Em **Credenciais** &gt; **Criar Credenciais** &gt; **ID do cliente OAuth**.</li>
            <li>Selecione *Aplicativo Web* e insira <code>http://localhost:5173</code> em **Origens JavaScript autorizadas**.</li>
            <li>Copie o **ID do cliente** gerado e cole abaixo.</li>
          </ol>
        </div>

        <form onSubmit={handleAdd} className="client-id-input-group">
          <label htmlFor="clientId">Adicionar Novo Google Client ID</label>
          <div className="client-input-wrapper">
            <input 
              id="clientId"
              type="text" 
              className="client-id-input" 
              placeholder="ex: 12345678-abc.apps.googleusercontent.com"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
            />
            <button type="submit" className="btn btn-add">Adicionar</button>
          </div>
          {error && <div style={{color: 'var(--color-unsub)', fontSize: '0.8rem', marginTop: '6px'}}>{error}</div>}
        </form>

        {clientIds.length > 0 && (
          <div className="client-id-input-group">
            <label>Seus Client IDs cadastrados</label>
            <div className="client-id-list">
              {clientIds.map((id) => (
                <div 
                  key={id} 
                  className={`client-id-item ${id === activeClientId ? 'active' : ''}`}
                  onClick={() => onSetActiveClientId(id)}
                  style={{cursor: 'pointer'}}
                >
                  <span className="client-id-item-text" title={id}>{id}</span>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    {id === activeClientId && <span className="client-id-item-badge">Ativo</span>}
                    <button 
                      type="button" 
                      className="client-id-item-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteClientId(id);
                      }}
                      title="Deletar Client ID"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{margin: '30px 0', borderTop: '1px solid var(--border-light)', paddingTop: '20px'}}>
          <p style={{fontSize: '0.9rem'}}>
            <strong>Alternativa (Poupar Quota de Leitura):</strong> Deseja importar a lista de canais offline usando o arquivo CSV do Google Takeout?
          </p>
          <label className="takeout-upload-box">
            <span className="takeout-upload-icon">📁</span>
            <div style={{fontSize: '0.9rem', fontWeight: 600}}>Carregar subscriptions.csv</div>
            <div style={{fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px'}}>
              Obtenha em takeout.google.com &gt; YouTube &gt; inscrições (Formato CSV)
            </div>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileChange}
            />
          </label>
        </div>

        {clientIds.length > 0 && onClose && (
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onClose} 
            style={{width: '100%', marginTop: '10px'}}
          >
            Voltar ao Aplicativo
          </button>
        )}
      </div>
    </div>
  );
}
