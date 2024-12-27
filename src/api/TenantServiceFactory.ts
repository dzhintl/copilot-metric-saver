// src/api/TenantServiceFactory.ts
import { MySQLTenantStorage } from './MySQLTenantStorage';
import { FileTenantStorage } from './FileTenantStorage';
import { ITenantStorage } from './ITenantStorage';

export class TenantServiceFactory {
    // Keep MySQLTenantStorage and FileTenantStorage as static so that we don't have to keep creating new instances of these classes
    static mysqlTenantStorage = new MySQLTenantStorage();
    static fileTenantStorage = new FileTenantStorage();
    
    static createTenantService(): ITenantStorage {
        const storageType = process.env.STORAGE_TYPE || 'file';
        switch (storageType) {
            case 'mysql':
                return this.mysqlTenantStorage;
            case 'file':
            default:
                return this.fileTenantStorage;
        }
    }
}