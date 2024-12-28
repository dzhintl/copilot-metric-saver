import { createConnection, Connection } from 'mysql2/promise';
import { IUsageStorage } from './IUsageStorage';
import { CopilotUsage, CopilotUsageBreakdown } from '../model/Copilot_Usage';
import { storage_config } from '../../config';
import { Tenant } from '../model/Tenant';
import { MySQLAbstractStorage } from './MySQLAbstractStorage';

export class MySQLUsageStorage extends MySQLAbstractStorage implements IUsageStorage {
    private scope_name: string = '';
    private type: string = '';
    private team?: string= '';

    constructor(tenant: Tenant) {
        super();
        this.initializeScope(tenant);
    }

    async initConnection() {
        try {
            this.dbConnection = await createConnection({
                host: storage_config.DB?.HOST,
                user: storage_config.DB?.USER,
                password: storage_config.DB?.PASSWORD,
                database: storage_config.DB?.DATABASE,
                port: storage_config.DB?.PORT,
            });
            console.log('Database connection established successfully in Usage Module.');
            this.initialized= true;
        } catch (error) {
            console.error('Error connecting to the database:', error);
            this.initialized = false;
        }
       
    }


    public async initializeScope(tenant: Tenant) {
        try {
            this.scope_name = tenant.scopeName;
            this.type = tenant.scopeType;
            this.team = tenant.team;
        } catch (error) {
            console.error('Error initializing Usage scope:', error);
        }
    }

    async initializeDatabase() {

        await this.ensureInitialized();
        
        const createCopilotUsageTableQuery = `
            CREATE TABLE IF NOT EXISTS CopilotUsage (
                id INT AUTO_INCREMENT PRIMARY KEY,
                day DATE NOT NULL,
                total_suggestions_count INT NOT NULL,
                total_acceptances_count INT NOT NULL,
                total_lines_suggested INT NOT NULL,
                total_lines_accepted INT NOT NULL,
                total_active_users INT NOT NULL,
                total_chat_acceptances INT DEFAULT 0,
                total_chat_turns INT DEFAULT 0,
                total_active_chat_users INT DEFAULT 0,
                type ENUM('organization','enterprise') NOT NULL,
                scope_name VARCHAR(255) NOT NULL,
                team VARCHAR(255) DEFAULT '',
                UNIQUE KEY unique_day_type_scope_team(day, type, scope_name,team)
            );
        `;

        const createCopilotUsageBreakdownTableQuery = `
            CREATE TABLE IF NOT EXISTS CopilotUsageBreakdown (
                id INT AUTO_INCREMENT PRIMARY KEY,
                day DATE NOT NULL,
                type ENUM('organization','enterprise') NOT NULL,
                scope_name VARCHAR(255) NOT NULL,
                team VARCHAR(255) DEFAULT '',
                language VARCHAR(255) NOT NULL,
                editor VARCHAR(255) NOT NULL,
                suggestions_count INT NOT NULL,
                acceptances_count INT NOT NULL,
                lines_suggested INT NOT NULL,
                lines_accepted INT NOT NULL,
                active_users INT NOT NULL,
                UNIQUE KEY unique_day_scope_team_lang_ide (day, type, scope_name(50), team(50), language(50), editor(50))
                );
        `;

        await this.dbConnection!.execute(createCopilotUsageTableQuery);
        await this.dbConnection!.execute(createCopilotUsageBreakdownTableQuery);
        console.log('Database Usage tables initialized.');
    }

    public async saveUsageData(CopilotUsage: CopilotUsage[],team_slug?:string): Promise<boolean> {
        await this.ensureInitialized();
        if (!team_slug) {
            team_slug = this.team;
        }

        console.log('team in saveUsageData:', team_slug);
        try {
            const CopilotUsageQuery = `
                INSERT INTO CopilotUsage (day, total_suggestions_count, total_acceptances_count, total_lines_suggested, total_lines_accepted, total_active_users, total_chat_acceptances, total_chat_turns, total_active_chat_users, type, scope_name, team)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                AS new
                ON DUPLICATE KEY UPDATE
                    total_suggestions_count = new.total_suggestions_count,
                    total_acceptances_count = new.total_acceptances_count,
                    total_lines_suggested = new.total_lines_suggested,
                    total_lines_accepted = new.total_lines_accepted,
                    total_active_users = new.total_active_users,
                    total_chat_acceptances = new.total_chat_acceptances,
                    total_chat_turns = new.total_chat_turns,
                    total_active_chat_users = new.total_active_chat_users,
                    type = new.type,
                    scope_name = new.scope_name,
                    team = new.team;
            `;

            const breakdownQuery = `
                INSERT INTO CopilotUsageBreakdown (day, type, scope_name, team, language, editor, suggestions_count, acceptances_count, lines_suggested, lines_accepted, active_users)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                AS new
                ON DUPLICATE KEY UPDATE
                    suggestions_count = new.suggestions_count,
                    acceptances_count = new.acceptances_count,
                    lines_suggested = new.lines_suggested,
                    lines_accepted = new.lines_accepted,
                    active_users = new.active_users,
                    type = new.type,
                    scope_name = new.scope_name,
                    team = new.team,
                    language = new.language,
                    editor = new.editor;
            `;

            for (const metric of CopilotUsage) {
                //print the metric data and its parameters
               // console.log('metric:', metric);
                // console.log('metric.day:', metric.day);
                // console.log('team:', this.team);
                // console.log('scope_name:', this.scope_name);
                // console.log('type:', this.type);
               // console.log ('CopilotUsageQuery:', CopilotUsageQuery);

                await this.dbConnection!.execute(CopilotUsageQuery, [
                    metric.day, metric.total_suggestions_count, metric.total_acceptances_count, metric.total_lines_suggested, metric.total_lines_accepted, metric.total_active_users, metric.total_chat_acceptances, metric.total_chat_turns, metric.total_active_chat_users, this.type, this.scope_name,team_slug
                ]);

                for (const breakdown of metric.breakdown) {
                    await this.dbConnection!.execute(breakdownQuery, [
                        metric.day, this.type, this.scope_name,team_slug, breakdown.language, breakdown.editor, breakdown.suggestions_count, breakdown.acceptances_count, breakdown.lines_suggested, breakdown.lines_accepted, breakdown.active_users
                    ]);
                }
            }
            return true;
        } catch (error) {
            console.error('Error saving usage data to MySQL:', error);
            return false;
        }
    }

    public async readUsageData(): Promise<CopilotUsage[]> {
        await this.ensureInitialized();
        console.log('team in readUsageData:', this.team);
        try {

            // need to check whether the team is null or '', it is null or '' then we need to pass team='' in the query.
            //or, the query should be  incluedes 'and team = ?' in the where clause.
            if (this.team === null || this.team === '') {
                this.team = '';
            }
            const CopilotUsageQuery = `
                SELECT day, total_suggestions_count, total_acceptances_count, total_lines_suggested, total_lines_accepted, total_active_users, total_chat_acceptances, total_chat_turns, total_active_chat_users 
                FROM CopilotUsage 
                WHERE type = ? AND scope_name = ? AND team = ?`;
            const breakdownQuery = `
                SELECT day, language, editor, suggestions_count, acceptances_count, lines_suggested, lines_accepted, active_users 
                FROM CopilotUsageBreakdown 
                WHERE type = ? AND scope_name = ? AND team = ?`;

            const [CopilotUsageRows] = await this.dbConnection!.execute(CopilotUsageQuery, [this.type, this.scope_name,this.team]);
            const [breakdownRows] = await this.dbConnection!.execute(breakdownQuery, [this.type, this.scope_name,this.team]);

            const breakdownMap = new Map<string, CopilotUsageBreakdown[]>();
            for (const row of breakdownRows as any[]) {
                const key = `${row.day}`;
                if (!breakdownMap.has(key)) {
                    breakdownMap.set(key, []);
                }
                breakdownMap.get(key)!.push(new CopilotUsageBreakdown(row));
            }

            return (CopilotUsageRows as any[]).map((row: any) => new CopilotUsage({
                ...row,
                breakdown: breakdownMap.get(`${row.day}`) || []
            }));
        } catch (error) {
            console.error('Error reading usage data from MySQL:', error);
            return [];
        }
    }

    public async queryUsageData(since?: string, until?: string, page: number = 1, per_page: number = 28): Promise<CopilotUsage[]> {
        await this.ensureInitialized();
        console.log('team in queryUsageData:', this.team);
        try {
            let query = `
                SELECT DATE_FORMAT(day, '%Y-%m-%d') as day, total_suggestions_count, total_acceptances_count, total_lines_suggested, total_lines_accepted, total_active_users, total_chat_acceptances, total_chat_turns, total_active_chat_users 
                FROM CopilotUsage 
                WHERE type = ? AND scope_name = ? AND  team = ?`;

            const params: any[] = [this.type, this.scope_name,this.team];

            if (since) {
                query += ' AND day >= ?';
                params.push(since);
            }

            if (until) {
                query += ' AND day <= ?';
                params.push(until);
            }

            // query += ' LIMIT ? OFFSET ?';
            // params.push(per_page, (page - 1) * per_page);

            console.log('query:', query);
            console.log('params:', params);

            const [rows] = await this.dbConnection!.execute(query, params);
            const CopilotUsages = (rows as any[]).map((row: any) => new CopilotUsage({
                ...row,
                breakdown: []
            }));

            for (const usage of CopilotUsages) {
                const breakdownQuery = `
                    SELECT DATE_FORMAT(day, '%Y-%m-%d') as day, language, editor, suggestions_count, acceptances_count, lines_suggested, lines_accepted, active_users 
                    FROM CopilotUsageBreakdown 
                    WHERE day = ? AND type = ? AND scope_name = ? AND team = ?`;
                const [breakdownRows] = await this.dbConnection!.execute(breakdownQuery, [usage.day, this.type, this.scope_name, this.team]);
                usage.breakdown = (breakdownRows as any[]).map((row: any) => new CopilotUsageBreakdown(row));
            }
            return CopilotUsages;

        } catch (error) {
            console.error('Error querying usage data from MySQL:', error);
            return [];
        }
    }
}