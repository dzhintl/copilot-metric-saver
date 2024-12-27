import { CopilotUsageStorageService } from './CopilotUsageStorageService';
import { CopilotMetricsStorageService } from './CopilotMetricsStorageService';
import { MySQLUsageStorage } from './MySQLUsageStorage';
import { FileUsageStorage } from './FileUsageStorage';
import { MySQLMetricsStorage } from './MySQLMetricsStorage';
import { FileMetricsStorage } from './FileMetricsStorage';
import { CopilotSeatStorageService } from './CopilotSeatStorageService';
import { MySQLSeatStorage } from './MySQLSeatStorage';
import { FileSeatStorage } from './FileSeatStorage';
import { storage_config } from '../../config';
import { Tenant } from '../model/Tenant';
import { TenantServiceFactory } from './TenantServiceFactory';

export class CopilotServiceFactory {
  // Keep MySQLUsageStorage and FileUsageStorage in static hash map so that we don't have to keep creating new instances of these classes
  static mysqlUsageStorages: { [key: string]: MySQLUsageStorage } = {};
  static fileUsageStorages: { [key: string]: FileUsageStorage } = {};

  // Keep MySQLSeatStorage and FileSeatStorage in static hash map so that we don't have to keep creating new instances of these classes
  static mysqlSeatStorages: { [key: string]: MySQLSeatStorage } = {};
  static fileSeatStorages: { [key: string]: FileSeatStorage } = {};

  // Keep MySQLMetricsStorage and FileMetricsStorage in static hash map so that we don't have to keep creating new instances of these classes
  static mysqlMetricsStorages: { [key: string]: MySQLMetricsStorage } = {};
  static fileMetricsStorages: { [key: string]: FileMetricsStorage } = {};

  static async createUsageService(tenant: Tenant) {
    // if the tenant is not provided, get it from the storage
    if (!tenant) {
      throw new Error('Tenant is needed');
    }
  
    let usageStorage;
    switch (storage_config.storage_type) {
      case 'mysql':
        // Check if the tenant is already in the hash map
        if (!this.mysqlUsageStorages[tenant.id]) {
          this.mysqlUsageStorages[tenant.id] = new MySQLUsageStorage(tenant);
        }
        usageStorage = this.mysqlUsageStorages[tenant.id];
        break;
      case 'file':
      default:
        // Check if the tenant is already in the hash map
        if (!this.fileUsageStorages[tenant.id]) {
          this.fileUsageStorages[tenant.id] = new FileUsageStorage(tenant);
        }
        usageStorage = this.fileUsageStorages[tenant.id];
        break;
    }

    return new CopilotUsageStorageService(usageStorage, tenant);
  }

  static async createSeatService(tenant?: Tenant, scopeName?: string) {
    // if the tenant is not provided, get it from the storage
    if (!tenant) {
      console.log('Tenant is missing, will querying it by scopeName');
      throw new Error('Tenant not found');
    
    }

    let seatStorage;
    switch (storage_config.storage_type) {
      case 'mysql':
        // Check if the tenant is already in the hash map
        if (!this.mysqlSeatStorages[tenant.id]) {
          this.mysqlSeatStorages[tenant.id] = new MySQLSeatStorage(tenant);
        }
        seatStorage = this.mysqlSeatStorages[tenant.id];
        break;
      case 'file':
      default:
        // Check if the tenant is already in the hash map
        if (!this.fileSeatStorages[tenant.id]) {
          this.fileSeatStorages[tenant.id] = new FileSeatStorage(tenant);
        }
        seatStorage = this.fileSeatStorages[tenant.id];
        break;
    }

    return new CopilotSeatStorageService(seatStorage, tenant);
  }

  static async createMetricsService(tenant: Tenant) {
    // if the tenant is not provided, get it from the storage
    if (!tenant) {
      throw new Error('Tenant is needed');
    }
  
    let metricsStorage;
    switch (storage_config.storage_type) {
      case 'mysql':
        // Check if the tenant is already in the hash map
        if (!this.mysqlMetricsStorages[tenant.id]) {
          this.mysqlMetricsStorages[tenant.id] = new MySQLMetricsStorage(tenant);
        }
        metricsStorage = this.mysqlMetricsStorages[tenant.id];
        break;
      case 'file':
      default:
        // Check if the tenant is already in the hash map
        if (!this.fileMetricsStorages[tenant.id]) {
          this.fileMetricsStorages[tenant.id] = new FileMetricsStorage(tenant);
        }
        metricsStorage = this.fileMetricsStorages[tenant.id];
        break;
    }

    return new CopilotMetricsStorageService(metricsStorage, tenant);
  }
}