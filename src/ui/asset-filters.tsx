import {
  ASSET_TYPES,
  type Asset,
  type AssetType,
} from '../shared/asset-types';

export type AssetFilters = {
  group: string;
  location: string;
  type: string;
  managed: 'all' | 'managed' | 'unmanaged';
};

export const EMPTY_ASSET_FILTERS: AssetFilters = {
  group: '',
  location: '',
  type: '',
  managed: 'all',
};

export function typeLabel(type: AssetType): string {
  if (type === 'virtual_server') {
    return 'Virtual server';
  }

  if (type === 'network_device') {
    return 'Network device';
  }

  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function uniqueFilterValues(assets: Asset[]): {
  groups: string[];
  locations: string[];
} {
  const groups = new Set<string>();
  const locations = new Set<string>();
  for (const asset of assets) {
    if (asset.assetGroup) {
      groups.add(asset.assetGroup);
    }
    if (asset.location) {
      locations.add(asset.location);
    }
  }
  return {
    groups: [...groups].sort((left, right) => left.localeCompare(right)),
    locations: [...locations].sort((left, right) => left.localeCompare(right)),
  };
}

function mergeNames(catalog: string[], extras: string[]): string[] {
  const names = new Set(catalog);
  for (const name of extras) {
    names.add(name);
  }
  return [...names].sort((left, right) => left.localeCompare(right));
}

export function filterCatalog(
  catalogGroups: string[],
  catalogLocations: string[],
  assets: Asset[],
): { groups: string[]; locations: string[] } {
  const fromAssets = uniqueFilterValues(assets);
  return {
    groups: mergeNames(catalogGroups, fromAssets.groups),
    locations: mergeNames(catalogLocations, fromAssets.locations),
  };
}

export function filterAssets(assets: Asset[], filters: AssetFilters): Asset[] {
  return assets.filter((asset) => {
    if (filters.group && asset.assetGroup !== filters.group) {
      return false;
    }
    if (filters.location && asset.location !== filters.location) {
      return false;
    }
    if (filters.type && asset.assetType !== filters.type) {
      return false;
    }
    if (filters.managed === 'managed' && asset.winrmManageable !== true) {
      return false;
    }
    if (filters.managed === 'unmanaged' && asset.winrmManageable === true) {
      return false;
    }
    return true;
  });
}

type AssetFilterBarProps = {
  filters: AssetFilters;
  onChange: (next: AssetFilters) => void;
  groups: string[];
  locations: string[];
};

export function AssetFilterBar({
  filters,
  onChange,
  groups,
  locations,
}: AssetFilterBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-health-subtle">Group</span>
        <select
          value={filters.group}
          onChange={(event) =>
            onChange({ ...filters, group: event.target.value })
          }
        >
          <option value="">All</option>
          {groups.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-health-subtle">Location</span>
        <select
          value={filters.location}
          onChange={(event) =>
            onChange({ ...filters, location: event.target.value })
          }
        >
          <option value="">All</option>
          {locations.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-health-subtle">Type</span>
        <select
          value={filters.type}
          onChange={(event) =>
            onChange({ ...filters, type: event.target.value })
          }
        >
          <option value="">All</option>
          {ASSET_TYPES.map((type) => (
            <option key={type} value={type}>
              {typeLabel(type)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-health-subtle">WinRM</span>
        <select
          value={filters.managed}
          onChange={(event) =>
            onChange({
              ...filters,
              managed: event.target.value as AssetFilters['managed'],
            })
          }
        >
          <option value="all">All</option>
          <option value="managed">Managed</option>
          <option value="unmanaged">Unmanaged</option>
        </select>
      </label>
    </div>
  );
}

type AssetSelectProps = {
  assets: Asset[];
  value: string;
  onChange: (assetId: string) => void;
  disabled?: boolean;
};

export function AssetSelect({
  assets,
  value,
  onChange,
  disabled,
}: AssetSelectProps) {
  return (
    <label className="grid min-w-72 flex-1 gap-1 text-sm">
      <span className="font-medium text-health-subtle">Asset</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select an asset</option>
        {assets.map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.hostname}
            {asset.ipAddress ? ` (${asset.ipAddress})` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
