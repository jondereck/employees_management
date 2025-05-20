import LoadingState from "@/components/loading-state";

const Loading = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-50 p-4">
      <div className="p-4 rounded-lg">
        <LoadingState />
      </div>
    </div>
  );
};

export default Loading;
