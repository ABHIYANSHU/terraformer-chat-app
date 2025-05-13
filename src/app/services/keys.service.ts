import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CloudKeys {
  accessKey: string;
  secretKey: string;
}

@Injectable({
  providedIn: 'root'
})
export class KeysService {
  private keysApiUrl = environment.keysApiUrl;
  private hasKeysSubject = new BehaviorSubject<boolean>(false);
  
  constructor(private http: HttpClient) {
    // Check if keys exist in local storage
    this.checkForExistingKeys();
  }
  
  /**
   * Save cloud keys to the API and local storage
   */
  saveKeys(keys: CloudKeys): Observable<any> {
    // Store in local storage for persistence
    localStorage.setItem('cloudKeys', JSON.stringify({
      accessKey: keys.accessKey,
      // We don't store the full secret key in local storage for security
      // Just store a flag that it exists
      hasSecretKey: !!keys.secretKey
    }));
    
    // Update the hasKeys subject
    this.hasKeysSubject.next(true);
    
    // Send to API
    return this.http.post(this.keysApiUrl, keys);
  }
  
  /**
   * Check if the user has already saved keys
   */
  hasKeys(): Observable<boolean> {
    return this.hasKeysSubject.asObservable();
  }
  
  /**
   * Get the access key (but not the secret key for security)
   */
  getAccessKey(): string | null {
    const keysData = localStorage.getItem('cloudKeys');
    if (keysData) {
      const keys = JSON.parse(keysData);
      return keys.accessKey;
    }
    return null;
  }
  
  /**
   * Clear saved keys
   */
  clearKeys(): void {
    localStorage.removeItem('cloudKeys');
    this.hasKeysSubject.next(false);
  }
  
  /**
   * Check if keys exist in local storage
   */
  private checkForExistingKeys(): void {
    const keysData = localStorage.getItem('cloudKeys');
    if (keysData) {
      const keys = JSON.parse(keysData);
      this.hasKeysSubject.next(!!keys.accessKey && keys.hasSecretKey);
    }
  }
}