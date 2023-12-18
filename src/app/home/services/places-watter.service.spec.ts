import { TestBed } from '@angular/core/testing';

import { PlacesWatterService } from './places-watter.service';

describe('PlacesWatterService', () => {
  let service: PlacesWatterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PlacesWatterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
