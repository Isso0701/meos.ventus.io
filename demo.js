'use strict';
(() => {
  const storageKey = 'meos-demo-v1';
  const now = Math.floor(Date.now() / 1000);
  const starterData = {
    units: [
      { id: 'unit-1', name: 'Eenheid 21-04', grade: 'Hoofdagent', street: 'Centrum' },
      { id: 'unit-2', name: 'Eenheid 21-12', grade: 'Agent', street: 'Havenkwartier' }
    ],
    events: [
      { id: 'event-1', createdAt: now - 480, data: { title: 'Verkeersongeval', message: 'Aanrijding met materiële schade. Eenheid ter plaatse.' } },
      { id: 'event-2', createdAt: now - 1860, data: { title: 'Overlastmelding', message: 'Melding ontvangen bij het stationsplein.' } }
    ],
    people: [
      { identifier: 'demo-1', firstname: 'Sam', lastname: 'de Vries', ssn: '123456789', dateofbirth: '14-03-1994', phone_number: '06-12345678', sex: 'M', height: 182, notes: [
        { title: 'Verkeerscontrole', body: 'Identiteit gecontroleerd tijdens een routinecontrole.', author_name: 'Agent Voorbeeld', createdAt: now - 86400 }
      ] },
      { identifier: 'demo-2', firstname: 'Noor', lastname: 'Bakker', ssn: '987654321', dateofbirth: '22-08-1998', phone_number: '06-87654321', sex: 'V', height: 170, notes: [] },
      { identifier: 'demo-3', firstname: 'Milan', lastname: 'Jansen', ssn: '456789123', dateofbirth: '05-11-1989', phone_number: '06-23456789', sex: 'M', height: 176, notes: [] }
    ],
    vehicles: [
      { plate: 'KX-482-P', modelLabel: 'Sultan', owner: 'demo-1', ownerName: 'Sam de Vries', signalering: false },
      { plate: 'T-914-LD', modelLabel: 'Blista', owner: 'demo-2', ownerName: 'Noor Bakker', signalering: true },
      { plate: 'P-203-RT', modelLabel: 'Asea', owner: 'demo-3', ownerName: 'Milan Jansen', signalering: false }
    ],
    reports: [
      { id: 1042, createdAt: now - 7200, data: { title: 'Verkeersongeval Centrum', officer: 'Agent Voorbeeld', location: 'Centrum', plates: ['KX-482-P'], body: 'Twee voertuigen betrokken bij een aanrijding. Geen gewonden gemeld.' } },
      { id: 1041, createdAt: now - 86400, data: { title: 'Controle stationsplein', officer: 'Hoofdagent Voorbeeld', location: 'Stationsplein', plates: [], body: 'Routinecontrole uitgevoerd naar aanleiding van een melding.' } }
    ],
    bolos: [
      { plate: 'T-914-LD', reason: 'Betrokken bij een fictieve demo-melding.', author: 'Agent Voorbeeld', createdAt: now - 3600 }
    ],
    nextReportId: 1043
  };

  function readState() {
    const saved = localStorage.getItem(storageKey);
    if (!saved) {
      localStorage.setItem(storageKey, JSON.stringify(starterData));
      return structuredClone(starterData);
    }
    try {
      return JSON.parse(saved);
    } catch (error) {
      throw new Error('De lokale demo-opslag is ongeldig. Wis de browseropslag om opnieuw te beginnen.');
    }
  }

  function saveState(state) {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function ok(data = {}) {
    return { ok: true, ...data };
  }

  function fail(error) {
    return { ok: false, error };
  }

  function includes(values, query) {
    const needle = String(query || '').trim().toLocaleLowerCase('nl-NL');
    return values.some(value => String(value || '').toLocaleLowerCase('nl-NL').includes(needle));
  }

  window.meosDemoApi = async (route, data = {}) => {
    try {
      const state = readState();
      const query = String(data.query || '').trim();
      switch (route) {
        case 'dashboard':
          return ok({
            units: state.units,
            events: state.events,
            reports: state.reports.length,
            bolos: state.bolos.length
          });
        case 'people': {
          if (query.length < 2) return fail('Zoek minimaal twee tekens.');
          const rows = state.people.filter(person => includes([
            person.firstname, person.lastname, person.ssn, person.phone_number
          ], query));
          return ok({ rows });
        }
        case 'person': {
          const person = state.people.find(row => row.identifier === data.identifier);
          if (!person) return fail('Deze demo-burger is niet gevonden.');
          const vehicles = state.vehicles.filter(vehicle => vehicle.owner === person.identifier).map(vehicle => ({
            ...vehicle, signalering: state.bolos.find(bolo => bolo.plate === vehicle.plate)?.reason || ''
          }));
          return ok({ person, vehicles, notes: person.notes });
        }
        case 'vehicles': {
          if (query.length < 2) return fail('Zoek minimaal twee tekens.');
          const rows = state.vehicles.filter(vehicle => includes([
            vehicle.plate, vehicle.modelLabel, vehicle.ownerName
          ], query)).map(vehicle => ({
            ...vehicle,
            signalering: state.bolos.some(bolo => bolo.plate === vehicle.plate)
          }));
          return ok({ rows });
        }
        case 'reports': {
          const matching = state.reports.filter(row => includes([
            row.id, row.data.title, row.data.body, row.data.officer, row.data.location,
            ...(row.data.plates || [])
          ], query)).sort((a, b) => b.createdAt - a.createdAt);
          const start = Math.max(0, Number(data.page) || 0) * 30;
          return ok({ rows: matching.slice(start, start + 30) });
        }
        case 'reportCreate': {
          const title = String(data.title || '').trim();
          const body = String(data.body || '').trim();
          if (!title || !body) return fail('Vul een titel en verslag in.');
          state.reports.push({
            id: state.nextReportId++,
            createdAt: Math.floor(Date.now() / 1000),
            data: {
              title,
              body,
              location: String(data.location || '').trim(),
              plates: String(data.plate || '').trim() ? [String(data.plate).trim().toUpperCase()] : [],
              officer: 'Demo gebruiker'
            }
          });
          saveState(state);
          return ok();
        }
        case 'noteCreate': {
          const person = state.people.find(row => row.identifier === data.identifier);
          const title = String(data.title || '').trim();
          const body = String(data.body || '').trim();
          if (!person) return fail('Deze demo-burger is niet gevonden.');
          if (!title || !body) return fail('Vul een titel en notitie in.');
          person.notes.push({
            title,
            body,
            author_name: 'Demo gebruiker',
            createdAt: Math.floor(Date.now() / 1000)
          });
          saveState(state);
          return ok();
        }
        case 'bolos':
          return ok({ rows: state.bolos.slice().sort((a, b) => b.createdAt - a.createdAt) });
        case 'boloSave': {
          const plate = String(data.plate || '').trim().toUpperCase();
          const reason = String(data.reason || '').trim();
          if (!/^[A-Z0-9 -]{2,12}$/.test(plate) || !reason) return fail('Vul een geldig kenteken en een reden in.');
          if (state.bolos.some(row => row.plate === plate)) return fail('Voor dit kenteken bestaat al een signalering.');
          state.bolos.push({ plate, reason, author: 'Demo gebruiker', createdAt: Math.floor(Date.now() / 1000) });
          saveState(state);
          return ok();
        }
        case 'boloRemove': {
          const index = state.bolos.findIndex(row => row.plate === String(data.plate || '').toUpperCase());
          if (index < 0) return fail('Deze signalering is niet gevonden.');
          state.bolos.splice(index, 1);
          saveState(state);
          return ok();
        }
        default:
          return fail(`Onbekende demo-actie: ${route}`);
      }
    } catch (error) {
      return fail(error instanceof Error ? error.message : 'De lokale demo-opslag is niet beschikbaar.');
    }
  };
})();
