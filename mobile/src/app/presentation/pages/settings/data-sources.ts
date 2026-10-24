import type { MessageKey } from '../../../i18n/translate';

/** A link of a credit: its text (as the source asks for it, or a text key) and where it goes. */
export interface SourceLink {
  readonly text: string;
  readonly url: string;
}

/**
 * A data source of «Acerca de»: what Atalaya takes from it and how it must be credited. A `citation`
 * is the source's own wording, kept in English in both languages (NASA asks for these exact words);
 * a `note` is said in the app's language. UNGRD and DANE are credited by app-data-attribution.
 */
export interface DataSource {
  readonly name: string;
  readonly use: MessageKey;
  readonly note?: MessageKey;
  readonly citation?: string;
  readonly links: readonly SourceLink[];
}

export const DATA_SOURCES: readonly DataSource[] = [
  {
    name: 'NASA FIRMS',
    use: 'about.firmsUse',
    note: 'about.nasaCitation',
    // https://www.earthdata.nasa.gov/data/tools/firms/faq ("acknowledgment in scientific journals").
    citation:
      'We acknowledge the use of imagery from the NASA LANCE FIRMS (https://earthdata.nasa.gov/firms), part of the NASA Earth Science Data and Information System (ESDIS).',
    links: [{ text: 'earthdata.nasa.gov/firms', url: 'https://earthdata.nasa.gov/firms' }],
  },
  {
    name: 'Open-Meteo',
    use: 'about.openMeteoUse',
    // https://open-meteo.com/en/licence: CC BY 4.0, with this link next to the data.
    links: [
      { text: 'Weather data by Open-Meteo.com', url: 'https://open-meteo.com/' },
      { text: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
    ],
  },
  {
    name: 'ERA5 · Copernicus',
    use: 'about.era5Use',
    // Copernicus licence, clauses 5.1.2 and 5.1.3 ("the following or any similar notice").
    note: 'about.copernicusNotice',
    links: [{ text: 'ERA5 (ECMWF)', url: 'https://doi.org/10.24381/cds.adbb2d47' }],
  },
  {
    name: 'NASA POWER',
    use: 'about.powerUse',
    // The page states no license, only the citation (and asks to be told about publications).
    note: 'about.powerCitation',
    // https://power.larc.nasa.gov/docs/referencing/ («POWER's Reference»).
    citation:
      "The data was obtained from National Aeronautics and Space Administration (NASA) Langley Research Center's Prediction Of Worldwide Energy Resources (POWER) project funded through the NASA Earth Science Division.",
    links: [{ text: 'power.larc.nasa.gov', url: 'https://power.larc.nasa.gov/' }],
  },
  {
    name: 'Gobernación de Nariño',
    use: 'about.governmentUse',
    note: 'about.governmentLicense',
    links: [{ text: 'narino.gov.co', url: 'https://narino.gov.co/' }],
  },
  {
    name: 'OpenStreetMap',
    use: 'about.osmUse',
    // https://www.openstreetmap.org/copyright: ODbL, credit with the attribution notice.
    links: [{ text: '© OpenStreetMap contributors · ODbL', url: 'https://www.openstreetmap.org/copyright' }],
  },
];
