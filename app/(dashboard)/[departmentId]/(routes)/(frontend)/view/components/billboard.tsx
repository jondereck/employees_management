import { Billboard, Offices } from "../types";

interface BillboardProps {
  data: Billboard;
  offices: Offices | Billboard;

}

const Billboard: React.FC<BillboardProps> = ({
  data,
  offices
}) => {
  console
  return ( 
    <div className="p-4 sm:p-6 lg:p-8 rounded-xl overflow-hidden">
      <div style={{ backgroundImage: `url(${data?.imageUrl})` }} className="rounded-xl relative aspect-square md:aspect-[2.4/1] overflow-hidden bg-cover">
        <div className="h-full w-full flex flex-col justify-center items-center text-center gap-y-8">
        <div className="font-bold text-4xl sm:text-5xl lg:text-6xl max-w-xs sm:max-w-prose bg-gray-200/50 p-4 rounded-lg shadow-md">
          {((offices as Offices)?.name !== null && (offices as Offices)?.name !== undefined)
              ? (offices as Offices)?.name
              : data?.label}

          </div>
        </div>
      </div>
    </div>
   );
};

export default Billboard;