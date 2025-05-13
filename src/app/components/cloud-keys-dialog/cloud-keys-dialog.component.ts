import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KeysService, CloudKeys } from '../../services/keys.service';

@Component({
  selector: 'app-cloud-keys-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cloud-keys-dialog.component.html',
  styleUrls: ['./cloud-keys-dialog.component.css']
})
export class CloudKeysDialogComponent implements OnInit {
  showDialog = false;
  accessKey = '';
  secretKey = '';
  hasKeys = false;
  isSaving = false;
  saveSuccess = false;
  saveError = false;
  errorMessage = '';

  constructor(private keysService: KeysService) {}

  ngOnInit(): void {
    // Check if keys already exist
    this.keysService.hasKeys().subscribe(hasKeys => {
      this.hasKeys = hasKeys;
      if (hasKeys) {
        // Pre-fill the access key if available
        const accessKey = this.keysService.getAccessKey();
        if (accessKey) {
          this.accessKey = accessKey;
        }
      }
    });
  }

  openDialog(): void {
    this.showDialog = true;
    this.saveSuccess = false;
    this.saveError = false;
  }

  closeDialog(): void {
    this.showDialog = false;
  }

  saveKeys(): void {
    if (!this.accessKey || !this.secretKey) {
      this.saveError = true;
      this.errorMessage = 'Both Access Key and Secret Key are required.';
      return;
    }

    this.isSaving = true;
    this.saveError = false;
    this.saveSuccess = false;

    const keys: CloudKeys = {
      accessKey: this.accessKey,
      secretKey: this.secretKey
    };

    this.keysService.saveKeys(keys).subscribe({
      next: () => {
        this.isSaving = false;
        this.saveSuccess = true;
        this.hasKeys = true;
        // Clear the secret key from memory after saving
        this.secretKey = '';
        
        // Close the dialog after a short delay
        setTimeout(() => {
          this.closeDialog();
        }, 2000);
      },
      error: (error) => {
        this.isSaving = false;
        this.saveError = true;
        this.errorMessage = error.message || 'Failed to save keys. Please try again.';
      }
    });
  }

  clearKeys(): void {
    this.keysService.clearKeys();
    this.accessKey = '';
    this.secretKey = '';
    this.hasKeys = false;
    this.saveSuccess = false;
  }
}