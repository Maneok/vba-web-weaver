import type { Genre } from "../../lib/lettreMissionContent";

interface GenreSelectorProps {
  value: Genre;
  onChange: (genre: Genre) => void;
}

export default function GenreSelector({ value, onChange }: GenreSelectorProps) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium text-gray-700">Civilité :</span>
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="radio"
          name="genre"
          checked={value === "M"}
          onChange={() => onChange("M")}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">Monsieur</span>
      </label>
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="radio"
          name="genre"
          checked={value === "Mme"}
          onChange={() => onChange("Mme")}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">Madame</span>
      </label>
    </div>
  );
}
