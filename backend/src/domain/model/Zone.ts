export interface Zone {
  readonly id: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  /** Other names of the municipality ("Tumaco", "Magüí Payán"), used to match news and datasets. */
  readonly aliases?: readonly string[];
}
