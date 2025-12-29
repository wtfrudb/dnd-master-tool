import React, { useState, useEffect, useCallback } from 'react';
import { 
  initDatabase, getTemplates, saveTemplate, deleteTemplate, updateTemplate,
  saveCurrentBattle, loadCurrentBattle, archiveBattle, getHistory 
} from './db';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('combat'); 
  const [entities, setEntities] = useState([]); 
  const [templates, setTemplates] = useState([]);
  const [history, setHistory] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false); 
  
  const [name, setName] = useState('');
  const [hp, setHp] = useState('10');
  const [mod, setMod] = useState('0');
  const [isNpc, setIsNpc] = useState(true);
  const [editingId, setEditingId] = useState(null);

  // НОВОЕ: Состояние для поиска
  const [searchQuery, setSearchQuery] = useState('');

  const refreshAllData = useCallback(async () => {
    try {
      const tpls = await getTemplates();
      const hist = await getHistory();
      setTemplates(tpls || []);
      setHistory(hist || []);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const start = async () => {
      try {
        await initDatabase();
        const savedBattle = await loadCurrentBattle();
        if (isMounted && savedBattle) {
          setEntities(savedBattle.map(ent => ({
            ...ent,
            currentHp: ent.current_hp,
            initMod: ent.init_mod,
            total: ent.total || 0
          })));
        }
        await refreshAllData();
      } finally { if (isMounted) setIsLoaded(true); }
    };
    start();
    return () => { isMounted = false; };
  }, [refreshAllData]);

  useEffect(() => {
    if (isLoaded) saveCurrentBattle(entities);
  }, [entities, isLoaded]);

  const handleSaveOrUpdate = async () => {
    const hpValue = parseInt(hp);
    const trimmedName = name.trim();
    if (!trimmedName || mod === '' || (isNpc && (isNaN(hpValue) || hpValue <= 0))) return;

    const isDuplicate = templates.some(tpl => 
      tpl.name.toLowerCase() === trimmedName.toLowerCase() && tpl.id !== editingId
    );

    if (isDuplicate) {
      alert(`Персонаж с именем "${trimmedName}" уже существует в библиотеке!`);
      return;
    }
    
    const data = { 
      name: trimmedName, 
      type: isNpc ? 'npc' : 'player', 
      baseHp: hpValue || 0, 
      initMod: parseInt(mod) || 0 
    };
    
    if (editingId) {
      await updateTemplate(editingId, data);
      setEditingId(null);
    } else {
      await saveTemplate(data);
    }
    
    setName(''); setMod('0'); setHp('10');
    await refreshAllData();
  };

  const startEdit = (tpl) => {
    setEditingId(tpl.id);
    setName(tpl.name);
    setMod(tpl.init_mod.toString());
    setIsNpc(tpl.type === 'npc');
    setHp(tpl.base_hp.toString());
    window.scrollTo(0, 0);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName(''); setMod('0'); setHp('10');
  };

  const confirmDelete = (tpl) => {
    if (window.confirm(`Удалить персонажа "${tpl.name}" из библиотеки?`)) {
      deleteTemplate(tpl.id).then(refreshAllData);
    }
  };

  const addFromTemplate = (tpl) => {
    setEntities(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      name: tpl.name,
      type: tpl.type,
      currentHp: tpl.base_hp,
      initMod: tpl.init_mod,
      total: 0
    }]);
  };

  const renderTemplateCard = (tpl) => (
    <div key={tpl.id} className={`template-card ${tpl.type}`}>
      <div className="tpl-card-main-row">
        <div className="tpl-info">
          <div className="tpl-name"><strong>{tpl.name}</strong></div>
          <div className="tpl-card-stats">
            <span>Мод: <strong>{tpl.init_mod >= 0 ? `+${tpl.init_mod}` : tpl.init_mod}</strong></span>
            {tpl.type === 'npc' && <span> | HP: <strong>{tpl.base_hp}</strong></span>}
          </div>
        </div>
        <div className="tpl-actions-column">
          <button onClick={() => startEdit(tpl)} className="row-edit-btn">Редактировать</button>
          <button onClick={() => confirmDelete(tpl)} className="row-del-btn">Удалить</button>
        </div>
      </div>
    </div>
  );

  // НОВОЕ: Фильтрация шаблонов на основе поиска
  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isLoaded) return <div className="container">Загрузка...</div>;

  return (
    <div className="container">
      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'combat' ? 'active' : ''}`} onClick={() => setActiveTab('combat')}>Битва</button>
        <button className={`tab-btn ${activeTab === 'library' ? 'active' : ''}`} onClick={() => setActiveTab('library')}>Библиотека</button>
        <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>История</button>
      </div>

      {activeTab === 'combat' ? (
        <div className="combat-screen">
          <div className="setup-section" style={{display: 'block'}}>
            <h4>Добавить участника:</h4>
            <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px'}}>
              {templates.sort((a,b) => a.name.localeCompare(b.name)).map(t => (
                <button key={t.id} onClick={() => addFromTemplate(t)} className="add-tpl-btn">+{t.name}</button>
              ))}
            </div>
            <div style={{marginTop: '15px', display: 'flex', gap: '10px'}}>
              <button onClick={async () => {
                const summary = entities.map(e => `${e.name}`).join(', ');
                await archiveBattle(`Бой завершен: ${summary}`);
                setEntities([]);
                refreshAllData();
              }} style={{background: '#27ae60', color: 'white'}}>Завершить</button>
              <button onClick={() => setEntities([])} style={{background: '#e74c3c', color: 'white'}}>Очистить</button>
            </div>
          </div>

          <div className="battle-list">
            {entities.map((ent, idx) => (
              <div key={ent.id} className={`entity-card ${ent.type === 'npc' && ent.currentHp <= 0 ? 'dead' : ''}`}>
                <div>
                  <span className={ent.type === 'npc' ? 'npc-label' : 'player-label'}>{ent.name}</span>
                  <div style={{fontSize: '0.8em'}}>Инит: <strong>{ent.total || '?'}</strong></div>
                </div>
                <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                  {ent.type === 'npc' && (
                    <div className="hp-section">
                      HP: <strong>{ent.currentHp}</strong>
                      <input type="number" id={`hp-v-${ent.id}`} style={{width: '40px', marginLeft: '5px'}} defaultValue="1" />
                      <button onClick={() => {
                        const val = parseInt(document.getElementById(`hp-v-${ent.id}`).value) || 0;
                        const newE = [...entities];
                        newE[idx].currentHp -= val;
                        setEntities(newE);
                      }}>-</button>
                    </div>
                  )}
                  {ent.type === 'player' && (
                    <input type="number" placeholder="Инит" style={{width: '50px'}} value={ent.total || ''}
                      onChange={e => {
                        const newE = [...entities];
                        newE[idx].total = parseInt(e.target.value) || 0;
                        setEntities(newE);
                      }} 
                    />
                  )}
                  <button onClick={() => setEntities(entities.filter(e => e.id !== ent.id))}>❌</button>
                </div>
              </div>
            ))}
          </div>
          {entities.length > 0 && (
            <button className="gen-btn" onClick={() => {
              const rolled = entities.map(ent => {
                if (ent.type === 'npc' || (ent.type === 'player' && !ent.total)) {
                  return { ...ent, total: (Math.floor(Math.random() * 20) + 1) + ent.initMod };
                }
                return ent;
              });
              setEntities([...rolled].sort((a, b) => b.total - a.total));
            }}>ГЕНЕРИРОВАТЬ ИНИЦИАТИВУ</button>
          )}
        </div>
      ) : activeTab === 'library' ? (
        <div className="library-screen">
          <div className="setup-section library-form-container">
            {editingId && <div className="edit-status">Редактирование: {name}</div>}
            
            <div className="library-form-row">
              <div className="input-field name-field">
                <label>Имя</label>
                <input className="name-input" placeholder="Гоблин" value={name} onChange={e => setName(e.target.value)} />
              </div>

              <div className="input-field mod-field">
                <label>Модификатор</label>
                <input type="number" className="mod-input-wide" value={mod} onChange={e => setMod(e.target.value)} />
              </div>

              <div className="input-field checkbox-field">
                <label>Тип</label>
                <div className="checkbox-aligner">
                  <input type="checkbox" id="npc-check" checked={isNpc} onChange={e => setIsNpc(e.target.checked)} />
                  <label htmlFor="npc-check">NPC</label>
                </div>
              </div>

              <div className="input-field hp-field">
                {isNpc && (
                  <>
                    <label>HP</label>
                    <input type="number" className="hp-input-field" value={hp} onChange={e => setHp(e.target.value)} />
                  </>
                )}
              </div>

              <div className="action-buttons">
                <button 
                  onClick={handleSaveOrUpdate} 
                  className="main-action-btn"
                  disabled={!name.trim() || mod === '' || (isNpc && (!hp || parseInt(hp) <= 0))}
                >
                  {editingId ? 'Обновить' : 'Сохранить'}
                </button>
                {editingId && <button onClick={cancelEdit} className="cancel-btn">Отмена</button>}
              </div>
            </div>
          </div>

          {/* НОВОЕ: Блок поиска */}
          <div className="search-container">
            <div className="search-wrapper">
              <span className="search-icon">🔍</span>
              <input 
                type="text" 
                className="search-input" 
                placeholder="Поиск персонажа по имени..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>
              )}
            </div>
          </div>
          
          <div className="library-content">
            <div className="library-group">
              <h3 className="group-label player-label-bg">Игроки</h3>
              <div className="template-grid">
                {filteredTemplates
                  .filter(t => t.type === 'player')
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(tpl => renderTemplateCard(tpl))}
              </div>
            </div>

            <div className="library-group">
              <h3 className="group-label npc-label-bg">NPC</h3>
              <div className="template-grid">
                {filteredTemplates
                  .filter(t => t.type === 'npc')
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(tpl => renderTemplateCard(tpl))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="history-screen">
          <h3>История</h3>
          {history.map(item => (
            <div key={item.id} className="entity-card" style={{flexDirection: 'column', alignItems: 'flex-start'}}>
              <div style={{fontSize: '0.8em', color: '#999'}}>{item.date}</div>
              <div>{item.summary}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;