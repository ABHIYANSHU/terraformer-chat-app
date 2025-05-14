export interface TerraformOutput {
  output: string;
  timestamp: Date;
}

export interface TerraformStatus {
  status: 'started' | 'completed' | 'error';
  message?: string;
  timestamp: Date;
}