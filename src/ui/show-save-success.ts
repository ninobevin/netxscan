import { toast } from 'sonner';

export function showSaveSuccess(message = 'Saved successfully.'): void {
  toast.success(message);
}
