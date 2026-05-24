import clsx from "clsx";

function Avatar({ name, gradient = "from-blue-400 to-violet-500" }) {
  return (
    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
      {(name?.[0] ?? "?").toUpperCase()}
    </div>
  );
}

export default function UserList({ users = [], currentUserId }) {
  return (
    <div className="flex flex-col gap-1 p-2">
      {users.map((user, i) => {
        const isMe      = user.id === currentUserId;
        const gradients = [
          "from-blue-400 to-violet-500",
          "from-pink-400 to-red-500",
          "from-emerald-400 to-teal-500",
          "from-amber-400 to-orange-500",
          "from-cyan-400 to-blue-500",
        ];
        return (
          <div
            key={user.id}
            className={clsx(
              "flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors",
              isMe ? "bg-blue-500/10" : "hover:bg-surface-700"
            )}
          >
            <div className="relative flex-shrink-0">
              <Avatar name={user.deviceName} gradient={gradients[i % gradients.length]} />
              {/* Online dot */}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-surface-900" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate leading-tight">
                {user.deviceName}
              </p>
              <p className={clsx("text-[11px] leading-tight", isMe ? "text-blue-400" : "text-slate-500")}>
                {isMe ? "You" : "Online"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
