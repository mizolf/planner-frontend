import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { TranslateService } from '@ngx-translate/core';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: TranslateService, useValue: { use: jasmine.createSpy('use') } }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should set default language to English', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const translateService = TestBed.inject(TranslateService);
    expect(translateService.use).toHaveBeenCalledWith('en');
  });
});
