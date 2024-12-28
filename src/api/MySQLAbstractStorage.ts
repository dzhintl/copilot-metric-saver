import { Connection } from "mysql2/promise";

export abstract class MySQLAbstractStorage {
    protected initialized: boolean = false;    
    protected dbConnection: Connection | null = null;
    protected initPromise: Promise<void>;
    
    abstract initConnection(): Promise<void>;
    abstract initializeDatabase(): Promise<void>;

    constructor() {
        this.initPromise = this.initConnection().then(() => {
            return this.initializeDatabase();
        });
    }

    protected async ensureInitialized() {
        // Re-initialize the connection if it is not initialized or if it is closed
        if (!this.initialized || await this.isConnectionClosed()) {
            console.log('Re-initializing connection in Seat modeule...');
            await this.initConnection();
        }
    }

    protected async isConnectionClosed(): Promise<boolean> {
        if (!this.dbConnection) {
            return true;
        }
        try {
            await this.dbConnection.ping();
            return false;
        } catch (error) {
            return true;
        }
    }
}