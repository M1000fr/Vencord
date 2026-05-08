import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import { checkAndRequestCsp } from "./csp";

export const settings = definePluginSettings({
    apiUrl: {
        type: OptionType.STRING,
        description: "URL de l'API Swallow (ex: https://api.swallow.fr)",
        default: "https://api.swallow.fr",
        placeholder: "https://api.swallow.fr",
        onChange: (value) => checkAndRequestCsp(value),
    },
    apiKey: {
        type: OptionType.STRING,
        description: "Clé API Bearer (sk-...)",
        default: "",
        placeholder: "sk-abc123...",
    },
});
