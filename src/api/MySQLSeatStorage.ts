// src/api/MySQLSeatStorage.ts
import { createConnection, Connection, OkPacket, RowDataPacket } from 'mysql2/promise';
import { ISeatStorage } from './ISeatStorage';
import { Tenant } from '../model/Tenant';
import { TotalSeats, Seat } from '../model/Seat';
import { storage_config } from '../../config';
import { MySQLAbstractStorage } from './MySQLAbstractStorage';

export class MySQLSeatStorage extends MySQLAbstractStorage implements ISeatStorage {
    private scope_name: string = '';
    private type: string = '';

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
                timezone: 'Z'
            });
            this.initialized = true;
            console.log('Database connection established successfully in seats module.');
        } catch (error) {
            console.error('Error connecting to the database:', error);
            this.initialized = false;
        }
    }

    public initializeScope(tenant: Tenant) {
        this.scope_name = tenant.scopeName;
        this.type = tenant.scopeType;
    }

    async initializeDatabase() {
        await this.ensureInitialized();
    
        const createSeatTableQuery = `
            CREATE TABLE IF NOT EXISTS CopilotSeats (
                id INT AUTO_INCREMENT PRIMARY KEY,
                login VARCHAR(255) NOT NULL,
                team VARCHAR(255),
                created_at TIMESTAMP NOT NULL,
                last_activity_at TIMESTAMP NULL,
                last_activity_editor VARCHAR(255),
                type ENUM('organization', 'enterprise', 'team') NOT NULL,
                scope_name VARCHAR(255) NOT NULL,
                refresh_time DATETIME NOT NULL
            );
        `;
    
        await this.dbConnection!.execute(createSeatTableQuery);
        console.log('Database tables initialized for seats module');
    }

    public async saveSeatData(seatData: TotalSeats): Promise<boolean> {
        await this.ensureInitialized();
    
        const refreshTime = new Date(); // current time for batch refresh, it should be 

        // Query latest last_activity_at for each login, type, and scope_name.
        const query = `
            SELECT 
                login, 
                type, 
                scope_name, 
                MAX(last_activity_at) AS last_activity_at 
            FROM 
                CopilotSeats 
            WHERE 
                type = ? AND scope_name = ? 
            GROUP BY 
                login, type, scope_name
        `;

        const [checkResults] = await this.dbConnection!.execute<RowDataPacket[]>(query, [this.type, this.scope_name]);

        const insertValues = seatData.seats.map(seat => {
            // Check if the seat data is already in the database
            const checkResult: RowDataPacket | undefined = checkResults.find((row: RowDataPacket) => row.login === seat.login);

            // Insert the seat data if it is not in the database or if the last_activity_at without time is different
            if (!checkResult || new Date(checkResult.last_activity_at).toDateString() !== new Date(seat.last_activity_at).toDateString()) {
                return [seat.login, seat.assigning_team, seat.created_at, seat.last_activity_at, seat.last_activity_editor, this.type, this.scope_name, refreshTime];
            }
            else {
                return null;
            }
        }).filter(value => value !== null);

        const updateValues = seatData.seats.map(seat => {
            // Check if the seat data is already in the database
            const checkResult: RowDataPacket | undefined = checkResults.find((row: RowDataPacket) => row.login === seat.login);

            // Update the seat data if it is in the database and the last_activity_at without time is the same
            if (checkResult && new Date(checkResult.last_activity_at).toDateString() === new Date(seat.last_activity_at).toDateString()) {
                return [seat.assigning_team, seat.created_at, seat.last_activity_at, seat.last_activity_editor, refreshTime, seat.login, this.type, this.scope_name];
            }
            else {
                return null;
            }
        }).filter(value => value !== null);
    
        const insertQuery = `
            INSERT INTO CopilotSeats (login, team, created_at, last_activity_at, last_activity_editor, type, scope_name, refresh_time)
            VALUES ?
        `;

        const updateQuery = `
            UPDATE CopilotSeats
            SET team = ?,
                created_at = ?,
                last_activity_at = ?,
                last_activity_editor = ?,
                refresh_time = ?
            WHERE login = ? AND type = ? AND scope_name = ?
        `;
    
        try {
            // Insert new rows
            if (insertValues.length !== 0) {
                const [insertResult] = await this.dbConnection!.query<OkPacket>(insertQuery, [insertValues]);
                console.log(`Inserted rows: ${insertResult.affectedRows} / ${insertValues.length}`);
            }

            // Update existing rows
            if (updateValues.length !== 0) {
                let updatedRows = 0;
                for (const updateValue of updateValues) {
                    const [updateResult] = await this.dbConnection!.query<OkPacket>(updateQuery, updateValue);
                    updatedRows += updateResult.affectedRows;
                }
                console.log(`Updated rows: ${updatedRows} / ${updateValues.length}`);
            }

            return true;
        } catch (error) {
            console.error('Error saving seat data:', error);
            return false;
        }
    }

      public async getSeatData(page?: number, per_page?: number): Promise<TotalSeats> {
        await this.ensureInitialized();
        try {
            const query = `
                SELECT 
                    login, 
                    team, 
                    created_at, 
                    last_activity_at, 
                    last_activity_editor,
                    refresh_time
                FROM 
                    CopilotSeats 
                WHERE 
                    (refresh_time) IN (
                        SELECT 
                            MAX(refresh_time) 
                        FROM 
                            CopilotSeats 
                        WHERE 
                            type = ? AND scope_name = ?
                    )
                AND 
                    type = ? AND scope_name = ?`    
            const params: any[] = [this.type, this.scope_name, this.type, this.scope_name]; 

    
            const [rows] = await this.dbConnection!.execute<RowDataPacket[]>(query, params);

            // Manually map the query results to Seat class
            const seats = rows.map(row => new Seat({
                login: row.login,
               // id: row.id, // Assuming there is an id field in the database
                assigning_team: row.team,
                created_at: row.created_at,
                last_activity_at: row.last_activity_at,
                last_activity_editor: row.last_activity_editor,
                refresh_time: row.refresh_time
            }));

            return new TotalSeats(seats);
        } catch (error) {
            console.error('Error reading seat data from MySQL:', error);
            return new TotalSeats([]);
        }
    }
    public async querySeatData(since?: string, until?: string, page: number = 1, per_page: number = 28): Promise<TotalSeats[]> {
        await this.ensureInitialized();
        try {
            let query = `
                SELECT 
                    login, 
                    MAX(team) AS team, 
                    MAX(created_at) AS created_at, 
                    last_activity_at, 
                    MAX(last_activity_editor) AS last_activity_editor 
                FROM 
                    CopilotSeats 
                WHERE type = ? AND scope_name = ?`;
    
            const params: any[] = [this.type, this.scope_name];
    
            // Validate and add since parameter
            if (since) {
                if (this.isValidDate(since)) {
                    query += ' AND last_activity_at >= ?';
                    params.push(since);
                } else {
                    console.error('Invalid date format for "since":', since);
                }
            }
    
            // Validate and add until parameter
            if (until) {
                if (this.isValidDate(until)) {
                    query += ' AND last_activity_at <= ?';
                    params.push(until);
                } else {
                    console.error('Invalid date format for "until":', until);
                }
            }
    
            // Add pagination parameters
            query += `
            GROUP BY 
                login, last_activity_at, type, scope_name `
            
           //     LIMIT ? OFFSET ?`;

           // params.push(per_page, (page - 1) * per_page);
    
            console.log('Query:', query);
    
            const [rows] = await this.dbConnection!.execute<RowDataPacket[]>(query, params);
            return [new TotalSeats(rows as Seat[])];
        } catch (error) {
            console.error('Error querying seat data from MySQL:', error);
            return [];
        }
    }
    
    // Private method to validate date format
    private isValidDate(dateString: string): boolean {
        const date = new Date(dateString);
        return !isNaN(date.getTime());
    }
}