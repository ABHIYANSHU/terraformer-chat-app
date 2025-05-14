import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { io, Socket } from 'socket.io-client';
import { TerraformOutput, TerraformStatus } from '../models/terraform-output';

@Injectable({
  providedIn: 'root'
})
export class SocketService implements OnDestroy {
  private socket: Socket;
  private terraformOutput = new Subject<TerraformOutput>();
  private terraformStatus = new Subject<TerraformStatus>();

  constructor() {
    // Connect to the socket server
    this.socket = io(environment.socketUrl);

    // Set up listeners
    this.socket.on('connect', () => {
      console.log('Socket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    // Listen for terraform output events
    this.socket.on('terraform-output', (data: {output: string}) => {
      console.log('Terraform output received:', data.output);
      this.terraformOutput.next({
        output: data.output,
        timestamp: new Date()
      });
    });

    // Listen for terraform status events
    this.socket.on('terraform-status', (data: {status: 'started' | 'completed' | 'error', message?: string}) => {
      console.log('Terraform status received:', data);
      this.terraformStatus.next({
        status: data.status,
        message: data.message,
        timestamp: new Date()
      });
    });
  }

  // Get terraform output as an observable
  getTerraformOutput(): Observable<TerraformOutput> {
    return this.terraformOutput.asObservable();
  }

  // Get terraform status as an observable
  getTerraformStatus(): Observable<TerraformStatus> {
    return this.terraformStatus.asObservable();
  }

  // Disconnect socket when service is destroyed
  ngOnDestroy(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}