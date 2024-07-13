import LoadingState from "@/components/loading-state";

const Loading = () => {
  return ( 
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50 p-4">
      <div className="p-4  rounded-lg shadow-lg sm:fixed sm:right-0 sm:bottom-0">
        <LoadingState />
      </div>
    </div>
  );
}
 
export default Loading;
