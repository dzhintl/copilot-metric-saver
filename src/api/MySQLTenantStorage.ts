// src/api/MySQLTenantStorage.ts
import { createConnection, Connection, ResultSetHeader } from 'mysql2/promise';
import { ITenantStorage } from './ITenantStorage';
import { Tenant } from '../model/Tenant';
import { storage_config } from '../../config';

export class MySQLTenantStorage implements ITenantStorage {
    private dbConnection: Connection | null = null;
    private initialized: boolean = false;
    private initPromise: Promise<void>;

    constructor() {
        this.initPromise = this.initConnection().then(() => {
            return this.initializeDatabase();
        });
    }

    private async initConnection() {
        try {
            this.dbConnection = await createConnection({
                host: storage_config.DB?.HOST,
                user: storage_config.DB?.USER,
                password: storage_config.DB?.PASSWORD,
                database: storage_config.DB?.DATABASE,
                port: storage_config.DB?.PORT,
            });
            console.log('Database connection established successfully in tenant module.');
            this.initialized = true;
        } catch (error) {
            console.error('Error connecting to the database:', error);
            this.initialized = false;
        }
    }

    private async initializeDatabase() {
        await this.ensureInitialized();

        const createTenantsTableQuery = `
            CREATE TABLE IF NOT EXISTS tenants (
                id INT AUTO_INCREMENT PRIMARY KEY,
                scopeName VARCHAR(255) NOT NULL,
                scopeType VARCHAR(50) NOT NULL,
                team VARCHAR(255) default '',
                token VARCHAR(100) NOT NULL,
                isActive BOOLEAN NOT NULL,
                UNIQUE KEY unique_scope_type (scopeName, scopeType, team)
            );
        `;

        try {
            await this.dbConnection!.execute(createTenantsTableQuery);
            console.log('Tenants table initialized.');
        } catch (error) {
            console.error('Error initializing tenants table:', error);
        }
    }

    private async ensureInitialized() {
        if (!this.initialized) {
            console.log('Re-initializing connection in tenant module...');
            await this.initPromise;
        }
    }

    async saveTenantData(tenant: Tenant): Promise<boolean> {
        await this.ensureInitialized();
        try {
            await this.dbConnection!.execute(
                'INSERT INTO tenants (scopeName, scopeType, team,token, isActive) VALUES (?, ?, ?,?, ?) ON DUPLICATE KEY UPDATE token = VALUES(token), isActive = VALUES(isActive)',
                [tenant.scopeName, tenant.scopeType, tenant.team,tenant.token, tenant.isActive]
            );
            return true;
        } catch (error) {
            console.error('Error saving tenant data to MySQL:', error);
            return false;
        }
    }

    async getTenantData(): Promise<Tenant[]> {
        await this.ensureInitialized();
        try {
            const query = `
                SELECT scopeType, scopeName, token, team, isActive
                FROM tenants
            `;
            const [rows] = await this.dbConnection!.execute(query);
            return (rows as any[]).map(row => new Tenant(row.scopeType, row.scopeName, row.token, row.team, row.isActive));
        } catch (error) {
            console.error('Error reading tenant data from MySQL:', error);
            return [];
        }
    }

    // Query tenant data by scope name. it will return the tenant data if found, otherwise it will return undefined.
    // and it is possible to have multiple tenants with the same scope name but different scope type. or different team.
    // so it is better to be updated to return an array of tenants.
    // or fetch the tenant data by scope name and scope type and team.
    async queryTenantData(name: string): Promise<Tenant | undefined> {
        await this.ensureInitialized();
        try {
            const [rows] = await this.dbConnection!.execute('SELECT * FROM tenants WHERE scopeName = ?', [name]);
            const tenants = (rows as any[]).map(row => new Tenant(row.scopeType, row.scopeName, row.token, row.isActive));
            return tenants.length > 0 ? tenants[0] : undefined;
        } catch (error) {
            console.error('Error querying tenant data from MySQL:', error);
            return undefined;
        }
    }

    async getActiveTenants(): Promise<{ scopeType: string, scopeName: string }[]> {
        await this.ensureInitialized();
        try {
            const [rows] = await this.dbConnection!.execute('SELECT scopeType, scopeName,team FROM tenants WHERE isActive = true');
            return rows as { scopeType: string, scopeName: string }[];
        } catch (error) {
            console.error('Error reading active tenants from MySQL:', error);
            return [];
        }
    }

    async removeTenantData(tenant: Tenant): Promise<boolean> {
        await this.ensureInitialized();
        try {
            const query = `
                DELETE FROM tenants
                WHERE scopeName = ? AND scopeType = ? AND team = ?
            `;
            const [result] = await this.dbConnection!.execute(query, [tenant.scopeName, tenant.scopeType, tenant.team]) as [ResultSetHeader, any];
            console.log(' the query is ',query);
            console.log('Remove tenant data result:', result);
            return result.affectedRows > 0;
            //return true;
        } catch (error) {
            console.error('Error removing tenant data from MySQL:', error);
            return false;
        }
    }
}