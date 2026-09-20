import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CategoryIcon } from './CategoryIcon';
import { ManageDevicesDialog, ManageLocationsDialog } from './CatalogManageDialogs';
import { showSaveSuccess } from './show-save-success';
import type { Asset, Category, Location } from '../shared/asset-types';
import type { PublicSession } from '../shared/auth-types';

const PAGE_SIZES = [10, 25, 50, 100] as const;

function subnet24(ip: string): string {
  const parts = ip.split('.');
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}

type AssetManagerPanelProps = {
  session: PublicSession;
};

export function AssetManagerPanel({ session }: AssetManagerPanelProps) {
  const isAdmin = session.role === 'administrator';
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(25);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [checking, setChecking] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [manageDevicesOpen, setManageDevicesOpen] = useState(false);
  const [manageLocationsOpen, setManageLocationsOpen] = useState(false);
  const [credOpen, setCredOpen] = useState(false);
  const [winUsername, setWinUsername] = useState('');
  const [winPassword, setWinPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const [assetResult, categoryResult, locationResult] = await Promise.all([
      window.netxscan.listAssets(),
      window.netxscan.listCategories(),
      window.netxscan.listLocations(),
    ]);
    if (assetResult.ok) {
      setAssets(assetResult.assets);
    }
    if (categoryResult.ok) {
      setCategories(categoryResult.categories);
    }
    if (locationResult.ok) {
      setLocations(locationResult.locations);
    }
  };

  useEffect(() => {
    void refresh();
    return window.netxscan.onWinrmProgress((event) => {
      setChecking((current) => {
        const next = new Set(current);
        if (event.status === 'checking' || event.status === 'starting') {
          next.add(event.assetId);
        } else {
          next.delete(event.assetId);
        }
        return next;
      });
      if (event.status === 'ok' || event.status === 'failed') {
        setAssets((current) =>
          current.map((asset) =>
            asset.id === event.assetId
              ? {
                  ...asset,
                  winrmOk: event.status === 'ok',
                  osVersion: event.osVersion ?? asset.osVersion,
                  macAddress: event.macAddress ?? asset.macAddress,
                  hostname: event.hostname ?? asset.hostname,
                }
              : asset,
          ),
        );
      }
    });
  }, []);

  const filtered = useMemo(() => {
    return assets.filter((asset) => {
      if (deviceFilter === 'none' && asset.categoryId !== null) {
        return false;
      }
      if (
        deviceFilter !== 'all' &&
        deviceFilter !== 'none' &&
        String(asset.categoryId) !== deviceFilter
      ) {
        return false;
      }
      if (locationFilter === 'none' && asset.locationId !== null) {
        return false;
      }
      if (
        locationFilter !== 'all' &&
        locationFilter !== 'none' &&
        String(asset.locationId) !== locationFilter
      ) {
        return false;
      }
      return true;
    });
  }, [assets, deviceFilter, locationFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const groups = useMemo(() => {
    const map = new Map<string, Asset[]>();
    for (const asset of pageRows) {
      const key = subnet24(asset.ipv4);
      const list = map.get(key) ?? [];
      list.push(asset);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [pageRows]);

  const pageIds = pageRows.map((asset) => asset.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const filteredIds = filtered.map((asset) => asset.id);

  const toggleId = (id: number, on: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (on) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const onDeviceChange = async (id: number, categoryId: string) => {
    const next = categoryId === '' ? null : Number(categoryId);
    const result = await window.netxscan.updateAsset(id, { categoryId: next });
    if (result.ok) {
      setAssets(result.assets);
      showSaveSuccess();
    }
  };

  const onLocationChange = async (id: number, locationId: string) => {
    const next = locationId === '' ? null : Number(locationId);
    const result = await window.netxscan.updateAsset(id, { locationId: next });
    if (result.ok) {
      setAssets(result.assets);
      showSaveSuccess();
    }
  };

  const openCheck = async () => {
    if (selected.size === 0) {
      setMessage('Select at least one asset.');
      return;
    }
    const identity = await window.netxscan.getWindowsIdentity();
    setWinUsername(identity.ok ? identity.username : '');
    setWinPassword('');
    setMessage(null);
    setCredOpen(true);
  };

  const onCheck = async () => {
    const username = winUsername.trim();
    const password = winPassword;
    if (!username || !password) {
      setMessage('Windows username and password are required.');
      return;
    }
    setCredOpen(false);
    setWinPassword('');
    setBusy(true);
    setMessage(null);
    const result = await window.netxscan.checkAccessibility([...selected], username, password);
    setBusy(false);
    if ('assets' in result && result.ok) {
      setAssets(result.assets);
      setMessage('Accessibility check finished.');
      return;
    }
    if (!result.ok) {
      setMessage(result.error);
    }
  };

  const onDelete = async () => {
    if (selected.size === 0) {
      return;
    }
    setBusy(true);
    const result = await window.netxscan.deleteAssets([...selected]);
    setBusy(false);
    if (result.ok) {
      setAssets(result.assets);
      setSelected(new Set());
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label>Device</Label>
          <Select
            value={deviceFilter}
            onValueChange={(value) => {
              setDeviceFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Device" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="none">No device</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Location</Label>
          <Select
            value={locationFilter}
            onValueChange={(value) => {
              setLocationFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="none">No location</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location.id} value={String(location.id)}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Rows per page</Label>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value) as (typeof PAGE_SIZES)[number]);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="secondary"
          onClick={() => setSelected(new Set(filteredIds))}
        >
          Select all matching filter
        </Button>
        {isAdmin ? (
          <>
            <Button disabled={busy || selected.size === 0} onClick={() => void openCheck()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Check accessibility
            </Button>
            <Button variant="secondary" onClick={() => setManageDevicesOpen(true)}>
              Device types
            </Button>
            <Button variant="secondary" onClick={() => setManageLocationsOpen(true)}>
              Locations
            </Button>
            <Button
              variant="destructive"
              disabled={busy || selected.size === 0}
              onClick={() => void onDelete()}
            >
              Delete selected
            </Button>
          </>
        ) : null}
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <p className="text-xs text-muted-foreground">
        {filtered.length} asset(s) · {selected.size} selected · grouped by /24 on this page
      </p>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allPageSelected}
                  onCheckedChange={(value) => {
                    setSelected((current) => {
                      const next = new Set(current);
                      for (const id of pageIds) {
                        if (value) {
                          next.add(id);
                        } else {
                          next.delete(id);
                        }
                      }
                      return next;
                    });
                  }}
                  aria-label="Select all on this page"
                />
              </TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Hostname</TableHead>
              <TableHead>MAC</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>OS</TableHead>
              <TableHead>WinRM</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell className="py-8 text-center text-muted-foreground" colSpan={8}>
                  No saved assets. Add hosts from Scanning.
                </TableCell>
              </TableRow>
            ) : (
              groups.flatMap(([subnet, rows]) => {
                const closed = collapsed.has(subnet);
                const header = (
                  <TableRow key={`${subnet}-h`} className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={8}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-sm font-medium"
                        onClick={() => {
                          setCollapsed((current) => {
                            const next = new Set(current);
                            if (next.has(subnet)) {
                              next.delete(subnet);
                            } else {
                              next.add(subnet);
                            }
                            return next;
                          });
                        }}
                      >
                        {closed ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                        {subnet}
                        <span className="text-xs font-normal text-muted-foreground">
                          {rows.length}
                        </span>
                      </button>
                    </TableCell>
                  </TableRow>
                );
                if (closed) {
                  return [header];
                }
                return [
                  header,
                  ...rows.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(asset.id)}
                          onCheckedChange={(value) => toggleId(asset.id, Boolean(value))}
                          aria-label={`Select ${asset.ipv4}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono">{asset.ipv4}</TableCell>
                      <TableCell>{asset.hostname ?? asset.ipv4}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {asset.macAddress ?? '—'}
                      </TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-2">
                            <CategoryIcon
                              name={asset.categoryIcon ?? 'CircleDashed'}
                            />
                            <Select
                              value={asset.categoryId === null ? 'none' : String(asset.categoryId)}
                              onValueChange={(value) => {
                                void onDeviceChange(
                                  asset.id,
                                  value === 'none' ? '' : value,
                                );
                              }}
                            >
                              <SelectTrigger className="h-8 w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No device</SelectItem>
                                {categories.map((category) => (
                                  <SelectItem key={category.id} value={String(category.id)}>
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <CategoryIcon
                              name={asset.categoryIcon ?? 'CircleDashed'}
                            />
                            {asset.categoryName ?? 'No device'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <Select
                            value={asset.locationId === null ? 'none' : String(asset.locationId)}
                            onValueChange={(value) => {
                              void onLocationChange(
                                asset.id,
                                value === 'none' ? '' : value,
                              );
                            }}
                          >
                            <SelectTrigger className="h-8 w-[160px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No location</SelectItem>
                              {locations.map((location) => (
                                <SelectItem key={location.id} value={String(location.id)}>
                                  {location.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          asset.locationName ?? 'No location'
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {asset.osVersion ?? '—'}
                      </TableCell>
                      <TableCell>
                        {checking.has(asset.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : asset.winrmOk ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>
                  )),
                ];
              })
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Page {safePage} of {pageCount}
        </span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={safePage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={safePage >= pageCount}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </Button>
        </div>
      </div>
      <Dialog
        open={credOpen}
        onOpenChange={(open) => {
          setCredOpen(open);
          if (!open) {
            setWinPassword('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Windows credentials</DialogTitle>
            <DialogDescription>
              Used only for this Check accessibility run. The password stays in memory and is not
              saved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="winrm-user">Username</Label>
              <Input
                id="winrm-user"
                value={winUsername}
                onChange={(event) => setWinUsername(event.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="winrm-password">Password</Label>
              <Input
                id="winrm-password"
                type="password"
                value={winPassword}
                onChange={(event) => setWinPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setWinPassword('');
                setCredOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void onCheck()}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ManageDevicesDialog
        open={manageDevicesOpen}
        onOpenChange={setManageDevicesOpen}
        categories={categories}
        onCategoriesChange={setCategories}
        onAssetsMayChange={() => {
          void refresh();
        }}
      />
      <ManageLocationsDialog
        open={manageLocationsOpen}
        onOpenChange={setManageLocationsOpen}
        locations={locations}
        onLocationsChange={setLocations}
        onAssetsMayChange={() => {
          void refresh();
        }}
      />
    </div>
  );
}
