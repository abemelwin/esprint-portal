export default function AllChecksLoading() {
  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <h1 className="text-xl font-bold text-gray-900">All Checks</h1>
      </div>
      <div className="bg-white border border-gray-100 rounded-xl p-3 h-14 animate-pulse" />
      <div className="bg-white border border-gray-200 rounded-2xl h-96 animate-pulse" />
    </div>
  );
}
