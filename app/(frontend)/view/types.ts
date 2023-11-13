export interface Billboard {
  id: string;
  label: string;
  imageUrl: string;
};

export interface Offices {
  id: string;
  name: string;
  billboard: Billboard;
}