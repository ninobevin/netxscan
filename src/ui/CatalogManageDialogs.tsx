import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CategoryIcon } from './CategoryIcon';
import { showSaveSuccess } from './show-save-success';
import { CATEGORY_ICON_ALLOWLIST } from '../shared/asset-types';
import type { Category, Location } from '../shared/asset-types';

type DeviceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onCategoriesChange: (categories: Category[]) => void;
  onAssetsMayChange: () => void;
};

export function ManageDevicesDialog({
  open,
  onOpenChange,
  categories,
  onCategoriesChange,
  onAssetsMayChange,
}: DeviceDialogProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Tag');
  const [editId, setEditId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resetForm = () => {
    setName('');
    setIcon('Tag');
    setEditId(null);
    setConfirmId(null);
    setMessage(null);
  };

  const startEdit = (category: Category) => {
    setEditId(category.id);
    setName(category.name);
    setIcon(category.icon);
    setConfirmId(null);
    setMessage(null);
  };

  const save = async () => {
    setBusy(true);
    const result =
      editId === null
        ? await window.netxscan.addCategory(name, icon)
        : await window.netxscan.updateCategory(editId, name, icon);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    onCategoriesChange(result.categories);
    onAssetsMayChange();
    resetForm();
    showSaveSuccess();
  };

  const remove = async (id: number) => {
    setBusy(true);
    const result = await window.netxscan.deleteCategory(id);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      setConfirmId(null);
      return;
    }
    onCategoriesChange(result.categories);
    onAssetsMayChange();
    if (editId === id) {
      resetForm();
    } else {
      setConfirmId(null);
    }
    showSaveSuccess('Device type deleted.');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          resetForm();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Device types</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <ul className="divide-y rounded-md border">
            {categories.map((category) => (
              <li key={category.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <CategoryIcon name={category.icon} className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{category.name}</span>
                {category.builtin ? (
                  <span className="text-xs text-muted-foreground">Built-in</span>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => startEdit(category)}
                >
                  Edit
                </Button>
                {category.builtin ? null : confirmId === category.id ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => void remove(category.id)}
                  >
                    Confirm
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => setConfirmId(category.id)}
                  >
                    Delete
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">{editId === null ? 'Add device type' : 'Edit device type'}</p>
            <div className="space-y-2">
              <Label htmlFor="manage-dev-name">Name</Label>
              <Input
                id="manage-dev-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ICON_ALLOWLIST.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button disabled={busy} onClick={() => void save()}>
                {editId === null ? 'Add' : 'Save'}
              </Button>
              {editId !== null ? (
                <Button variant="secondary" disabled={busy} onClick={resetForm}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
          <p className="text-xs text-muted-foreground">
            Deleting a custom type clears that device on assigned assets. Built-in types cannot be deleted.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type LocationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: Location[];
  onLocationsChange: (locations: Location[]) => void;
  onAssetsMayChange: () => void;
};

export function ManageLocationsDialog({
  open,
  onOpenChange,
  locations,
  onLocationsChange,
  onAssetsMayChange,
}: LocationDialogProps) {
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resetForm = () => {
    setName('');
    setEditId(null);
    setConfirmId(null);
    setMessage(null);
  };

  const startEdit = (location: Location) => {
    setEditId(location.id);
    setName(location.name);
    setConfirmId(null);
    setMessage(null);
  };

  const save = async () => {
    setBusy(true);
    const result =
      editId === null
        ? await window.netxscan.addLocation(name)
        : await window.netxscan.updateLocation(editId, name);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    onLocationsChange(result.locations);
    onAssetsMayChange();
    resetForm();
    showSaveSuccess();
  };

  const remove = async (id: number) => {
    setBusy(true);
    const result = await window.netxscan.deleteLocation(id);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      setConfirmId(null);
      return;
    }
    onLocationsChange(result.locations);
    onAssetsMayChange();
    if (editId === id) {
      resetForm();
    } else {
      setConfirmId(null);
    }
    showSaveSuccess('Location deleted.');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          resetForm();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Locations</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <ul className="divide-y rounded-md border">
            {locations.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No locations yet.</li>
            ) : (
              locations.map((location) => (
                <li key={location.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{location.name}</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => startEdit(location)}
                  >
                    Edit
                  </Button>
                  {confirmId === location.id ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => void remove(location.id)}
                    >
                      Confirm
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => setConfirmId(location.id)}
                    >
                      Delete
                    </Button>
                  )}
                </li>
              ))
            )}
          </ul>
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">{editId === null ? 'Add location' : 'Edit location'}</p>
            <div className="space-y-2">
              <Label htmlFor="manage-loc-name">Name</Label>
              <Input
                id="manage-loc-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button disabled={busy} onClick={() => void save()}>
                {editId === null ? 'Add' : 'Save'}
              </Button>
              {editId !== null ? (
                <Button variant="secondary" disabled={busy} onClick={resetForm}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
          <p className="text-xs text-muted-foreground">
            Deleting a location clears it on assigned assets.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
