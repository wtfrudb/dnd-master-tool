import Database from '@tauri-apps/plugin-sql';

let db = null;

/**
 * Инициализация базы данных и создание таблиц
 */
export const initDatabase = async () => {
    if (db) return db;

    try {
        console.log("DB: Начинаем загрузку...");
        // В Tauri 2.0 используем путь без лишних префиксов
        db = await Database.load("sqlite:dnd_data.db");
        console.log("DB: Плагин загружен успешно");

        // Таблица шаблонов персонажей
        await db.execute(`CREATE TABLE IF NOT EXISTS templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            base_hp INTEGER,
            init_mod INTEGER
        )`);

        // Таблица текущего состояния боя (для автосохранения)
        await db.execute(`CREATE TABLE IF NOT EXISTS current_battle (
            id TEXT PRIMARY KEY,
            name TEXT,
            type TEXT,
            current_hp INTEGER,
            init_mod INTEGER,
            total INTEGER
        )`);

        // Таблица истории завершенных сражений
        await db.execute(`CREATE TABLE IF NOT EXISTS combat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            summary TEXT
        )`);

        console.log("DB: Все таблицы проверены/созданы");
        return db;
    } catch (err) {
        console.error("КРИТИЧЕСКАЯ ОШИБКА БД:", err);
        return null;
    }
};

const checkDb = () => {
    if (!db) {
        console.warn("Попытка доступа к БД до её инициализации");
        return false;
    }
    return true;
};

// --- ШАБЛОНЫ (БИБЛИОТЕКА) ---

export const getTemplates = async () => {
    if (!checkDb()) return [];
    try {
        return await db.select("SELECT * FROM templates");
    } catch (e) { return []; }
};

export const saveTemplate = async (entity) => {
    if (!checkDb()) return;
    return await db.execute(
        "INSERT INTO templates (name, type, base_hp, init_mod) VALUES ($1, $2, $3, $4)",
        [entity.name, entity.type, parseInt(entity.baseHp) || 0, parseInt(entity.initMod) || 0]
    );
};

/**
 * НОВАЯ ФУНКЦИЯ: Обновление существующего шаблона
 */
export const updateTemplate = async (id, entity) => {
    if (!checkDb()) return;
    try {
        return await db.execute(
            "UPDATE templates SET name = $1, type = $2, base_hp = $3, init_mod = $4 WHERE id = $5",
            [
                entity.name, 
                entity.type, 
                parseInt(entity.baseHp) || 0, 
                parseInt(entity.initMod) || 0, 
                id
            ]
        );
    } catch (e) {
        console.error("Ошибка при обновлении шаблона:", e);
    }
};

export const deleteTemplate = async (id) => {
    if (!checkDb()) return;
    return await db.execute("DELETE FROM templates WHERE id = $1", [id]);
};

// --- ТЕКУЩИЙ БОЙ ---

export const saveCurrentBattle = async (entities) => {
    if (!checkDb()) return;
    try {
        await db.execute("DELETE FROM current_battle");
        for (const ent of entities) {
            await db.execute(
                "INSERT INTO current_battle (id, name, type, current_hp, init_mod, total) VALUES ($1, $2, $3, $4, $5, $6)",
                [
                    ent.id, 
                    ent.name, 
                    ent.type, 
                    parseInt(ent.currentHp) || 0, 
                    parseInt(ent.initMod) || 0, 
                    parseInt(ent.total) || 0
                ]
            );
        }
    } catch (e) { console.error("Ошибка автосохранения боя:", e); }
};

export const loadCurrentBattle = async () => {
    if (!checkDb()) return [];
    try {
        return await db.select("SELECT * FROM current_battle");
    } catch (e) { return []; }
};

// --- ИСТОРИЯ ---

export const archiveBattle = async (summary) => {
    if (!checkDb()) return;
    return await db.execute("INSERT INTO combat_history (summary) VALUES ($1)", [summary]);
};

export const getHistory = async () => {
    if (!checkDb()) return [];
    try {
        return await db.select("SELECT * FROM combat_history ORDER BY date DESC");
    } catch (e) { return []; }
};