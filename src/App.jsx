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
  const [searchQuery, setSearchQuery] = useState('');

  const [showTieModal, setShowTieModal] = useState(false);
  const [tiedEntities, setTiedEntities] = useState([]);

  const [isBattleStarted, setIsBattleStarted] = useState(false);

  const [selectedEntityId, setSelectedEntityId] = useState(null);

  const refreshAllData = useCallback(async () => {
    try {
      const tpls = await getTemplates();
      const hist = await getHistory();
      setTemplates(tpls || []);
      setHistory(hist || []);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedEntityId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
    if (tpl.type === 'player' && entities.some(e => e.name === tpl.name)) {
      alert(`Игрок ${tpl.name} уже добавлен в битву!`);
      return;
    }

    let finalName = tpl.name;
    if (tpl.type === 'npc') {
      const count = entities.filter(e => e.name.startsWith(tpl.name)).length;
      if (count > 0) {
        finalName = `${tpl.name} ${count + 1}`;
      }
    }

    setEntities(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      name: finalName,
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
          <div className="setup-section">
            {/* Стилизованный заголовок */}
            <h2 className="section-title">Добавить в бой</h2>
            
            <div className="quick-add-grid">
              <div className="add-group">
                <span className="subsection-label">Игроки</span>
                <div className="add-buttons-container">
                  {templates.filter(t => t.type === 'player').sort((a,b) => a.name.localeCompare(b.name)).map(t => (
                    <button key={t.id} onClick={() => addFromTemplate(t)} className="btn-add-player">+{t.name}</button>
                  ))}
                </div>
              </div>

              <div className="add-group">
                <span className="subsection-label">NPC / Монстры</span>
                <div className="add-buttons-container">
                  {templates.filter(t => t.type === 'npc').sort((a,b) => a.name.localeCompare(b.name)).map(t => (
                    <button key={t.id} onClick={() => addFromTemplate(t)} className="btn-add-npc">+{t.name}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Стилизованные нижние кнопки управления */}
            {entities.length > 0 && (
              <div className="bottom-actions">
                <button 
                  className="clear-btn" 
                  onClick={() => {
                    setIsBattleStarted(false);
                    if (window.confirm("Очистить список текущего боя?")) setEntities([]);
                  }}
                >
                  Очистить список
                </button>
                
                <button 
                  className="finish-btn"
                  onClick={async () => {
                    setIsBattleStarted(false);
                    if (window.confirm("Завершить бой и сохранить в историю?")) {
                      const summary = entities.map(e => `${e.name}`).join(', ');
                      await archiveBattle(`Бой завершен: ${summary}`);
                      setEntities([]);
                      refreshAllData();
                    }
                  }}
                >
                  Завершить бой
                </button>
              </div>
            )}
          </div>
          
          

          <div className="battle-list">
            {entities.map((ent, idx) => (
              <div key={ent.id} onClick={() => setSelectedEntityId(ent.id)} className={`entity-card ${ent.type === 'npc' && ent.currentHp <= 0 ? 'dead' : ''} ${ent.isCrossed ? 'crossed-out' : ''} ${selectedEntityId === ent.id ? 'selected' : ''}`} style={{ cursor: 'pointer' }}>                {/* Левая часть: Имя */}
                <div style={{ flexShrink: 0 }}>
                  <span className={ent.type === 'npc' ? 'npc-label' : 'player-label'}>{ent.name}</span>
                  <div style={{fontSize: '0.8em', color: '#666'}}>Инициатива: <strong>{ent.total || '?'}</strong></div>
                </div>
                
                {/* Правая часть: Все контроли */}
                <div className="card-controls-right">
                  
                  {/* Секция HP для NPC */}
                  {ent.type === 'npc' && ent.total > 0 && (
                    <div className="hp-control-group">
                      <span className="hp-label-text" style={{ minWidth: '55px' }}>
                        HP: <span style={{color: '#c0392b'}}>{ent.currentHp}</span>
                      </span>
                      <button 
                        className="hp-minus-btn-styled"
                        onClick={() => {
                          const val = Math.abs(parseInt(document.getElementById(`hp-v-${ent.id}`).value)) || 0;
                          const newE = [...entities];
                          newE[idx].currentHp -= val; 
                          setEntities(newE);
                        }}
                      > − </button>
                      <input 
                        type="number" 
                        id={`hp-v-${ent.id}`} 
                        className="battle-input-styled" 
                        style={{width: '40px'}} 
                        defaultValue="1" 
                      />
                      <button 
                        className="hp-plus-btn-styled"
                        onClick={() => {
                          const val = Math.abs(parseInt(document.getElementById(`hp-v-${ent.id}`).value)) || 0;
                          const newE = [...entities];
                          newE[idx].currentHp += val; 
                          setEntities(newE);
                        }}
                      > + </button>
                    </div>
                  )}
                  
                  {/* Секция Инициативы для Игрока */}
                  {ent.type === 'player' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {!isBattleStarted ? (
                        <>
                          <span className="hp-label-text">Инициатива:</span>
                          <input 
                            type="number" 
                            className="battle-input-styled" 
                            style={{ width: '55px' }} 
                            placeholder="🎲"
                            value={ent.total || ''}
                            onChange={e => {
                              const newE = [...entities];
                              newE[idx].total = parseInt(e.target.value) || 0;
                              setEntities(newE);
                            }} 
                          />
                        </>
                      ) : (
                        // После нажатмя "Генерировать" поле исчезает, остается только число слева
                        <div style={{ width: '0px' }}></div> 
                      )}
                    </div>
                  )}

                  {/* Группа кнопок управления (Смерть и Удаление) */}
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button 
                      onClick={() => {
                        const newE = [...entities];
                        newE[idx].isCrossed = !newE[idx].isCrossed;
                        setEntities(newE);
                      }}
                      className={`death-btn ${ent.isCrossed ? 'active' : ''}`}
                    >
                      💀
                    </button>
                    <button 
                      className="delete-row-btn"
                      onClick={() => {
                        if (window.confirm(`Удалить ${ent.name}?`)) {
                          setEntities(entities.filter(e => e.id !== ent.id));
                        }
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {entities.length > 0 && (
            <button className="gen-btn" onClick={() => {
              setIsBattleStarted(true);
              const rolled = entities.map(ent => {
                if (ent.type === 'npc' || (ent.type === 'player' && !ent.total)) {
                  return { ...ent, total: (Math.floor(Math.random() * 20) + 1) + ent.initMod, tieBreaker: 0 };
                }
                return { ...ent, tieBreaker: 0 };
              });

              const totals = rolled.map(e => e.total);
              const hasTies = totals.some((t, idx) => totals.indexOf(t) !== idx);

              if (hasTies) {
                const tieGroups = rolled.filter(e => totals.filter(t => t === e.total).length > 1);
                setTiedEntities(tieGroups);
                setShowTieModal(true);
                setEntities(rolled); 
              } else {
                setEntities([...rolled].sort((a, b) => b.total - a.total));
              }
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
                {filteredTemplates.filter(t => t.type === 'player').sort((a, b) => a.name.localeCompare(b.name)).map(tpl => renderTemplateCard(tpl))}
              </div>
            </div>

            <div className="library-group">
              <h3 className="group-label npc-label-bg">NPC</h3>
              <div className="template-grid">
                {filteredTemplates.filter(t => t.type === 'npc').sort((a, b) => a.name.localeCompare(b.name)).map(tpl => renderTemplateCard(tpl))}
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

      {/* МОДАЛЬНОЕ ОКНО ДЛЯ РАЗРЕШЕНИЯ СПОРОВ С ГРУППИРОВКОЙ И ПРЕДПРОСМОТРОМ */}
      {showTieModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px', display: 'flex', flexDirection: 'row', gap: '20px', alignItems: 'stretch' }}>
            
            {/* ЛЕВАЯ ЧАСТЬ: ВВОД ПЕРЕБРОСОВ */}
            <div style={{ flex: 1, textAlign: 'left' }}>
              <h3>Спорная инициатива!</h3>
              <p style={{ fontSize: '0.9em', color: '#666' }}>Введите d20 для разрешения ничьей:</p>
              
              <div className="tie-groups-container" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {Object.entries(
                  tiedEntities.reduce((acc, ent) => {
                    if (!acc[ent.total]) acc[ent.total] = [];
                    acc[ent.total].push(ent);
                    return acc;
                  }, {})
                )
                .sort((a, b) => b[0] - a[0])
                .map(([total, group]) => (
                  <div key={total} className="tie-group-block" style={{ marginBottom: '15px', border: '1px solid #eee', borderRadius: '8px', padding: '10px' }}>
                    <div style={{ fontWeight: 'bold', color: '#e67e22', borderBottom: '1px solid #eee', marginBottom: '10px', fontSize: '0.9em' }}>
                      Инициатива: {total}
                    </div>
                    {group.map(ent => (
                      <div key={ent.id} className="tie-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85em', fontWeight: '500' }}>{ent.name}</span>
                        <div className="tie-actions">
                          {ent.type === 'npc' ? (
                            <div className="input-field mod-field" style={{ margin: 0 }}>
                              <button 
                                className="tie-dice-btn"
                                style={{ 
                                  height: '38px', 
                                  width: '100%', 
                                  minWidth: '90px', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center',
                                  gap: '5px' 
                                }}
                                onClick={() => {
                                  const newVal = Math.floor(Math.random() * 20) + 1;
                                  setTiedEntities(prev => prev.map(p => p.id === ent.id ? {...p, tieBreaker: newVal} : p));
                                }}
                              >
                                {ent.tieBreaker > 0 ? `🎲 ${ent.tieBreaker}` : 'Бросить d20'}
                              </button>
                            </div>
                          ) : (
                            <div className="input-field mod-field" style={{ margin: 0 }}>
                              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <span style={{ 
                                  position: 'absolute', 
                                  left: '10px', 
                                  pointerEvents: 'none', 
                                  fontSize: '0.9em', 
                                  opacity: 0.7 
                                }}>🎲</span>
                                <input 
                                  type="number" 
                                  className="mod-input-wide" 
                                  placeholder="d20"
                                  style={{ 
                                    width: '100px', 
                                    height: '38px', 
                                    paddingLeft: '30px', // Отступ под иконку кубика
                                    textAlign: 'center' 
                                  }}
                                  value={ent.tieBreaker || ''}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    setTiedEntities(prev => prev.map(p => p.id === ent.id ? {...p, tieBreaker: val} : p));
                                  }}
                                  onFocus={(e) => e.target.select()}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* ПРАВАЯ ЧАСТЬ: ЖИВОЙ ПРЕДПРОСМОТР ПОРЯДКА */}
            <div style={{ width: '220px', background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ marginTop: 0, marginBottom: '10px', fontSize: '0.9em', borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>Будущий порядок:</h4>
              <div style={{ flex: 1, overflowY: 'auto', fontSize: '0.85em' }}>
                {[...entities].map(ent => {
                  const tied = tiedEntities.find(t => t.id === ent.id);
                  return tied ? { ...ent, tieBreaker: tied.tieBreaker } : ent;
                })
                .sort((a, b) => {
                  if (b.total !== a.total) return b.total - a.total;
                  return b.tieBreaker - a.tieBreaker;
                })
                .map((ent, idx) => {
                  const isCurrentlyTied = tiedEntities.some(t => t.id === ent.id);
                  return (
                    <div key={ent.id} style={{ 
                      padding: '4px 0', 
                      borderBottom: '1px solid #eee',
                      color: isCurrentlyTied ? '#e67e22' : '#333',
                      fontWeight: isCurrentlyTied ? 'bold' : 'normal'
                    }}>
                      {idx + 1}. {ent.name} 
                      <span style={{ float: 'right', color: '#999', fontSize: '0.8em' }}>{ent.total}</span>
                    </div>
                  );
                })}
              </div>

              <button 
                className="gen-btn" 
                // Блокируем кнопку, если есть персонажи с tieBreaker равным 0 или пустым
                disabled={tiedEntities.some(ent => !ent.tieBreaker || ent.tieBreaker === 0)}
                style={{ 
                  marginTop: '15px', 
                  width: '100%', 
                  padding: '10px', 
                  fontSize: '0.85em',
                  // Визуальные стили для заблокированного состояния
                  backgroundColor: tiedEntities.some(ent => !ent.tieBreaker || ent.tieBreaker === 0) ? '#ccc' : '#e67e22',
                  cursor: tiedEntities.some(ent => !ent.tieBreaker || ent.tieBreaker === 0) ? 'not-allowed' : 'pointer',
                  border: 'none',
                  color: 'white',
                  borderRadius: '4px',
                  transition: 'background-color 0.3s'
                }} 
                onClick={() => {
                  const updatedAll = entities.map(ent => {
                    const tied = tiedEntities.find(t => t.id === ent.id);
                    return tied ? { ...ent, tieBreaker: tied.tieBreaker } : ent;
                  });

                  // Проверяем, есть ли повторные ничьи среди тех, кто сейчас перебрасывал
                  const stillTied = updatedAll.filter(e1 => 
                    updatedAll.some(e2 => 
                      e1.id !== e2.id && 
                      e1.total === e2.total && 
                      e1.tieBreaker === e2.tieBreaker
                    )
                  );

                  if (stillTied.length > 0) {
                    alert("Снова ничья! Нужно перебросить еще раз для тех, кто совпал.");
                    // Оставляем в окне только тех, кто всё еще в ничьей, и обнуляем им бросок
                    setTiedEntities(stillTied.map(ent => ({ ...ent, tieBreaker: 0 })));
                    setEntities(updatedAll);
                  } else {
                    // Все споры разрешены
                    const finalSorted = [...updatedAll].sort((a, b) => {
                      if (b.total !== a.total) return b.total - a.total;
                      return b.tieBreaker - a.tieBreaker;
                    });
                    setEntities(finalSorted);
                    setShowTieModal(false);
                  }
                }}
              >
                {/* Меняем текст кнопки в зависимости от состояния */}
                {tiedEntities.some(ent => !ent.tieBreaker || ent.tieBreaker === 0) 
                  ? "Заполните все броски" 
                  : "Принять порядок"}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default App;