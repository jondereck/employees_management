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
      <div className="h-full w-full flex justify-center items-center text-center gap-y-8 bg-black/20">
        <div className="font-arizona font-bold text-slate-50 text-4xl sm:text-5xl lg:text-7xl max-w-xs drop-shadow-2xl  hover:text-green-400 transform hover:scale-105 transition duration-300">
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