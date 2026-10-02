/**
 * The 64 municipalities of Nariño, from DIVIPOLA (DANE), dataset "DIVIPOLA - Códigos municipios" on
 * datos.gov.co (gdxc-w37w), downloaded 2026-10-01 with:
 *   https://www.datos.gov.co/resource/gdxc-w37w.json?$where=cod_dpto='52'&$order=cod_mpio
 * Names are DANE's (title case), coordinates are DANE's point for the municipal seat (cabecera).
 *
 * Ids: lower case, no accents, hyphens. "tumaco" keeps the id it had before (the official name is
 * San Andrés de Tumaco), so the stored weather and fire events still point to it.
 * Aliases: other names used by the press and by the UNGRD dataset ("MAGUI PAYAN", "EL CONTADERO").
 */
export interface Municipality {
  /** DIVIPOLA code (DANE). */
  readonly divipola: number;
  readonly id: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly aliases: readonly string[];
}

export const NARINO_MUNICIPALITIES: readonly Municipality[] = [
  { divipola: 52001, id: 'pasto', name: 'Pasto', latitude: 1.212352, longitude: -77.278795, aliases: ['San Juan de Pasto'] },
  { divipola: 52019, id: 'alban', name: 'Albán', latitude: 1.474978, longitude: -77.080712, aliases: ['San José de Albán'] },
  { divipola: 52022, id: 'aldana', name: 'Aldana', latitude: 0.882381, longitude: -77.700564, aliases: [] },
  { divipola: 52036, id: 'ancuya', name: 'Ancuya', latitude: 1.263276, longitude: -77.514512, aliases: [] },
  { divipola: 52051, id: 'arboleda', name: 'Arboleda', latitude: 1.503418, longitude: -77.135467, aliases: [] },
  { divipola: 52079, id: 'barbacoas', name: 'Barbacoas', latitude: 1.671733, longitude: -78.13765, aliases: [] },
  { divipola: 52083, id: 'belen', name: 'Belén', latitude: 1.595681, longitude: -77.015619, aliases: [] },
  { divipola: 52110, id: 'buesaco', name: 'Buesaco', latitude: 1.381453, longitude: -77.156463, aliases: [] },
  { divipola: 52203, id: 'colon', name: 'Colón', latitude: 1.643878, longitude: -77.019777, aliases: ['Colón Génova'] },
  { divipola: 52207, id: 'consaca', name: 'Consacá', latitude: 1.207854, longitude: -77.466136, aliases: [] },
  { divipola: 52210, id: 'contadero', name: 'Contadero', latitude: 0.910458, longitude: -77.549409, aliases: ['El Contadero'] },
  { divipola: 52215, id: 'cordoba', name: 'Córdoba', latitude: 0.854564, longitude: -77.517897, aliases: [] },
  { divipola: 52224, id: 'cuaspud-carlosama', name: 'Cuaspud Carlosama', latitude: 0.862978, longitude: -77.728947, aliases: ['Cuaspud', 'Carlosama'] },
  { divipola: 52227, id: 'cumbal', name: 'Cumbal', latitude: 0.906367, longitude: -77.792505, aliases: [] },
  { divipola: 52233, id: 'cumbitara', name: 'Cumbitara', latitude: 1.647163, longitude: -77.578616, aliases: [] },
  { divipola: 52240, id: 'chachagui', name: 'Chachagüí', latitude: 1.360545, longitude: -77.281869, aliases: [] },
  { divipola: 52250, id: 'el-charco', name: 'El Charco', latitude: 2.479688, longitude: -78.110217, aliases: [] },
  { divipola: 52254, id: 'el-penol', name: 'El Peñol', latitude: 1.453567, longitude: -77.438522, aliases: [] },
  { divipola: 52256, id: 'el-rosario', name: 'El Rosario', latitude: 1.745309, longitude: -77.33417, aliases: [] },
  { divipola: 52258, id: 'el-tablon-de-gomez', name: 'El Tablón de Gómez', latitude: 1.427277, longitude: -77.097101, aliases: ['El Tablón'] },
  { divipola: 52260, id: 'el-tambo', name: 'El Tambo', latitude: 1.407913, longitude: -77.390772, aliases: [] },
  { divipola: 52287, id: 'funes', name: 'Funes', latitude: 1.001159, longitude: -77.448913, aliases: [] },
  { divipola: 52317, id: 'guachucal', name: 'Guachucal', latitude: 0.959744, longitude: -77.731589, aliases: [] },
  { divipola: 52320, id: 'guaitarilla', name: 'Guaitarilla', latitude: 1.129574, longitude: -77.549824, aliases: [] },
  { divipola: 52323, id: 'gualmatan', name: 'Gualmatán', latitude: 0.919652, longitude: -77.568701, aliases: [] },
  { divipola: 52352, id: 'iles', name: 'Iles', latitude: 0.96952, longitude: -77.521227, aliases: [] },
  { divipola: 52354, id: 'imues', name: 'Imués', latitude: 1.05506, longitude: -77.496339, aliases: [] },
  { divipola: 52356, id: 'ipiales', name: 'Ipiales', latitude: 0.827732, longitude: -77.646367, aliases: [] },
  { divipola: 52378, id: 'la-cruz', name: 'La Cruz', latitude: 1.601318, longitude: -76.970504, aliases: [] },
  { divipola: 52381, id: 'la-florida', name: 'La Florida', latitude: 1.29753, longitude: -77.402882, aliases: [] },
  { divipola: 52385, id: 'la-llanada', name: 'La Llanada', latitude: 1.472892, longitude: -77.58091, aliases: [] },
  { divipola: 52390, id: 'la-tola', name: 'La Tola', latitude: 2.398999, longitude: -78.189725, aliases: [] },
  { divipola: 52399, id: 'la-union', name: 'La Unión', latitude: 1.600219, longitude: -77.131316, aliases: [] },
  { divipola: 52405, id: 'leiva', name: 'Leiva', latitude: 1.934453, longitude: -77.306135, aliases: [] },
  { divipola: 52411, id: 'linares', name: 'Linares', latitude: 1.350814, longitude: -77.523953, aliases: [] },
  { divipola: 52418, id: 'los-andes', name: 'Los Andes', latitude: 1.494587, longitude: -77.521303, aliases: ['Los Andes Sotomayor', 'Sotomayor'] },
  { divipola: 52427, id: 'magui', name: 'Magüí', latitude: 1.765633, longitude: -78.182924, aliases: ['Magüí Payán'] },
  { divipola: 52435, id: 'mallama', name: 'Mallama', latitude: 1.141037, longitude: -77.864549, aliases: [] },
  { divipola: 52473, id: 'mosquera', name: 'Mosquera', latitude: 2.507139, longitude: -78.452992, aliases: [] },
  { divipola: 52480, id: 'narino', name: 'Nariño', latitude: 1.288979, longitude: -77.357972, aliases: [] },
  { divipola: 52490, id: 'olaya-herrera', name: 'Olaya Herrera', latitude: 2.347457, longitude: -78.325814, aliases: [] },
  { divipola: 52506, id: 'ospina', name: 'Ospina', latitude: 1.058433, longitude: -77.566082, aliases: [] },
  { divipola: 52520, id: 'francisco-pizarro', name: 'Francisco Pizarro', latitude: 2.040629, longitude: -78.658361, aliases: ['Salahonda'] },
  { divipola: 52540, id: 'policarpa', name: 'Policarpa', latitude: 1.627196, longitude: -77.458686, aliases: [] },
  { divipola: 52560, id: 'potosi', name: 'Potosí', latitude: 0.806639, longitude: -77.573003, aliases: [] },
  { divipola: 52565, id: 'providencia', name: 'Providencia', latitude: 1.237814, longitude: -77.596794, aliases: [] },
  { divipola: 52573, id: 'puerres', name: 'Puerres', latitude: 0.885125, longitude: -77.504211, aliases: [] },
  { divipola: 52585, id: 'pupiales', name: 'Pupiales', latitude: 0.870442, longitude: -77.636042, aliases: [] },
  { divipola: 52612, id: 'ricaurte', name: 'Ricaurte', latitude: 1.212492, longitude: -77.995153, aliases: [] },
  { divipola: 52621, id: 'roberto-payan', name: 'Roberto Payán', latitude: 1.697492, longitude: -78.245716, aliases: [] },
  { divipola: 52678, id: 'samaniego', name: 'Samaniego', latitude: 1.335438, longitude: -77.594341, aliases: [] },
  { divipola: 52683, id: 'sandona', name: 'Sandoná', latitude: 1.283438, longitude: -77.47313, aliases: [] },
  { divipola: 52685, id: 'san-bernardo', name: 'San Bernardo', latitude: 1.513762, longitude: -77.0475, aliases: [] },
  { divipola: 52687, id: 'san-lorenzo', name: 'San Lorenzo', latitude: 1.503362, longitude: -77.21542, aliases: [] },
  { divipola: 52693, id: 'san-pablo', name: 'San Pablo', latitude: 1.669429, longitude: -77.013984, aliases: [] },
  { divipola: 52694, id: 'san-pedro-de-cartago', name: 'San Pedro de Cartago', latitude: 1.551572, longitude: -77.11941, aliases: [] },
  { divipola: 52696, id: 'santa-barbara', name: 'Santa Bárbara', latitude: 2.449653, longitude: -77.979916, aliases: ['Santa Bárbara de Iscuandé', 'Iscuandé'] },
  { divipola: 52699, id: 'santacruz', name: 'Santacruz', latitude: 1.222589, longitude: -77.677035, aliases: ['Santacruz de Guachavés', 'Guachavés'] },
  { divipola: 52720, id: 'sapuyes', name: 'Sapuyes', latitude: 1.037536, longitude: -77.62028, aliases: [] },
  { divipola: 52786, id: 'taminango', name: 'Taminango', latitude: 1.570358, longitude: -77.2808, aliases: [] },
  { divipola: 52788, id: 'tangua', name: 'Tangua', latitude: 1.09482, longitude: -77.393735, aliases: [] },
  { divipola: 52835, id: 'tumaco', name: 'San Andrés de Tumaco', latitude: 1.807399, longitude: -78.764073, aliases: ['Tumaco'] },
  { divipola: 52838, id: 'tuquerres', name: 'Túquerres', latitude: 1.085044, longitude: -77.61672, aliases: [] },
  { divipola: 52885, id: 'yacuanquer', name: 'Yacuanquer', latitude: 1.115937, longitude: -77.400169, aliases: [] },
];
