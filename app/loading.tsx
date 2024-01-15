import LoadingState from "@/components/loading-state";

const Loading = () => {
  return ( 
    <div className="fixed top-0 left-0 w-full h-full bg-black/40 z-50 justify-center items-center">
      <LoadingState />
    </div>
   );
}
 
export default Loading;